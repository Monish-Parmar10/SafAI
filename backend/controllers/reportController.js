const Report = require('../models/Report');
const Worker = require('../models/Worker');
const { uploadToCloudinary, fetchImageAsBase64 } = require('../middleware/cloudinary');

// 1. Create Report (POST /api/reports)
const createReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Photo is required' });
    }

    const { lat, lng, address } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    // Upload photo to Cloudinary first
    const imageUrl = await uploadToCloudinary(req.file.buffer, 'safai/reports');

    const rawData = JSON.stringify({
      user_app_id: {
        user_id: process.env.CLARIFAI_USER_ID,
        app_id: process.env.CLARIFAI_APP_ID
      },
      inputs: [{ data: { image: { url: imageUrl } } }]
    });

    const clarifaiResponse = await fetch("https://api.clarifai.com/v2/models/general-image-recognition/outputs", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": "Key " + process.env.CLARIFAI_PAT
      },
      body: rawData
    });

    if (!clarifaiResponse.ok) {
      throw new Error(`Clarifai API failed: ${clarifaiResponse.statusText}`);
    }

    const clarifaiResult = await clarifaiResponse.json();
    const concepts = clarifaiResult.outputs[0].data.concepts;
    const garbageKeywords = ['garbage', 'trash', 'waste', 'litter', 'debris', 'rubbish', 'dump', 'pollution'];
    
    let aiDetected = false;
    let maxConfidence = 0;
    
    for (const concept of concepts) {
      if (garbageKeywords.includes(concept.name.toLowerCase())) {
        if (concept.value > 0.6) {
          aiDetected = true;
        }
        if (concept.value > maxConfidence) {
          maxConfidence = concept.value;
        }
      }
    }

    const aiConfidence = Math.round(maxConfidence * 100);
    let severity = 'low';
    if (aiConfidence > 90) severity = 'high';
    else if (aiConfidence > 75) severity = 'medium';

    const aiReason = aiDetected 
      ? `Detected garbage/trash with ${aiConfidence}% confidence.` 
      : "Area looks clean, no garbage detected.";

    // Find first available worker
    const worker = await Worker.findOne({ status: 'available' });

    // Create the Report document with Cloudinary URL
    const reportData = {
      imageUrl,  // Cloudinary HTTPS URL — permanent!
      location: {
        lat: Number(lat),
        lng: Number(lng),
        address: address || ''
      },
      aiDetected,
      aiConfidence,
      severity,
      status: worker ? 'assigned' : 'open',
      assignedWorker: worker ? worker._id : null
    };

    const savedReport = await Report.create(reportData);

    // If worker is available, assign the task
    let assignedWorkerData = null;
    if (worker) {
      worker.status = 'busy';
      worker.currentTask = savedReport._id;
      await worker.save();

      assignedWorkerData = {
        name: worker.name,
        phone: worker.phone,
        ward: worker.ward
      };
    }

    return res.status(201).json({
      success: true,
      report: savedReport,
      assignedWorker: assignedWorkerData,
      aiResult: {
        detected: aiDetected,
        confidence: aiConfidence,
        severity,
        reason: aiReason
      }
    });

  } catch (error) {
    console.error('Error creating report:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// 2. Get All Reports (GET /api/reports)
const getAllReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('assignedWorker')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 3. Get Stats (GET /api/stats)
const getStats = async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const resolved = await Report.countDocuments({ status: 'done' });
    const pending = await Report.countDocuments({ status: { $in: ['open', 'assigned'] } });

    const doneReports = await Report.find({ status: 'done', completedAt: { $ne: null } });

    let avgResolutionTime = 0;
    if (doneReports.length > 0) {
      const totalTimeMs = doneReports.reduce((acc, report) => {
        const timeDiff = report.completedAt.getTime() - report.createdAt.getTime();
        return acc + timeDiff;
      }, 0);
      const totalTimeMin = totalTimeMs / (1000 * 60);
      avgResolutionTime = totalTimeMin / doneReports.length;
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalReports,
        resolved,
        pending,
        avgResolutionTime: Math.round(avgResolutionTime * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 4. Complete Report (PATCH /api/reports/:id/complete)
const completeReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Completion photo is required' });
    }

    const { id } = req.params;
    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (report.status === 'done' || report.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Report is already marked as resolved' });
    }

    // Get before image as base64 — fetch from Cloudinary URL
    let beforeBase64, afterBase64;
    try {
      beforeBase64 = await fetchImageAsBase64(report.imageUrl);
      afterBase64 = req.file.buffer.toString('base64');
    } catch (fetchErr) {
      console.error('Error fetching/reading images:', fetchErr);
      return res.status(500).json({ success: false, message: 'Failed to load images for AI validation' });
    }

    const rawData = JSON.stringify({
      user_app_id: {
        user_id: process.env.CLARIFAI_USER_ID,
        app_id: process.env.CLARIFAI_APP_ID
      },
      inputs: [{ data: { image: { base64: afterBase64 } } }]
    });

    const clarifaiResponse = await fetch("https://api.clarifai.com/v2/models/general-image-recognition/outputs", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": "Key " + process.env.CLARIFAI_PAT
      },
      body: rawData
    });

    if (!clarifaiResponse.ok) {
      throw new Error(`Clarifai API failed: ${clarifaiResponse.statusText}`);
    }

    const clarifaiResult = await clarifaiResponse.json();
    const concepts = clarifaiResult.outputs[0].data.concepts;
    const garbageKeywords = ['garbage', 'trash', 'waste', 'litter', 'debris', 'rubbish', 'dump', 'pollution'];
    
    let isClean = true;
    let foundReason = "";

    for (const concept of concepts) {
      if (garbageKeywords.includes(concept.name.toLowerCase())) {
        if (concept.value > 0.5) {
          isClean = false;
          foundReason = `Detected ${concept.name} (Confidence: ${Math.round(concept.value * 100)}%). Area still not clean.`;
          break;
        }
      }
    }

    const aiResult = {
      cleaned: isClean,
      confidence: isClean ? 95 : 0,
      reason: foundReason || "The garbage has been cleared and the area is clean."
    };

    if (aiResult.cleaned === true) {
      // Upload the after/completion photo to Cloudinary
      const completionImageUrl = await uploadToCloudinary(req.file.buffer, 'safai/completions');

      const assignedWorkerId = report.assignedWorker;

      report.status = 'completed';
      report.completionImageUrl = completionImageUrl;
      report.afterPhoto = completionImageUrl;
      report.completedAt = new Date();
      const updatedReport = await report.save();

      // Free up the worker
      if (assignedWorkerId) {
        const worker = await Worker.findById(assignedWorkerId);
        if (worker) {
          worker.status = 'available';
          worker.currentTask = null;
          await worker.save();
        }
      }

      return res.status(200).json({ success: true, report: updatedReport });
    } else {
      // AI rejected — no file to clean up (memoryStorage), just return error
      return res.status(400).json({
        success: false,
        message: aiResult.reason || 'AI verification failed. Please ensure the area is clean.'
      });
    }

  } catch (error) {
    console.error('Error completing report:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// 5. Accept Report (PATCH /api/reports/:id/accept)
const acceptReport = async (req, res) => {
  try {
    const { id } = req.params;

    // Atomic findOneAndUpdate — only succeeds if still unassigned
    const report = await Report.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { status: 'pending' },
          { status: 'open' },
          { assignedWorker: null }
        ]
      },
      {
        $set: {
          assignedWorker: req.user._id,
          status: 'accepted'
        }
      },
      { new: true }
    );

    if (!report) {
      return res.status(409).json({
        success: false,
        message: 'This request was already accepted by another worker.'
      });
    }

    const worker = await Worker.findById(req.user._id);
    if (worker) {
      worker.status = 'busy';
      worker.currentTask = report._id;
      await worker.save();
    }

    return res.status(200).json({ success: true, report });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createReport,
  getAllReports,
  getStats,
  completeReport,
  acceptReport
};
