const fetch = require('node-fetch');

async function testClarifaiREST() {
  const PAT = "dummy_pat";
  const USER_ID = "dummy_user";
  const APP_ID = "main";
  const IMAGE_URL = "https://samples.clarifai.com/metro-north.jpg";

  const raw = JSON.stringify({
    "user_app_id": {
      "user_id": USER_ID,
      "app_id": APP_ID
    },
    "inputs": [
      {
        "data": {
          "image": {
            "url": IMAGE_URL
          }
        }
      }
    ]
  });

  const requestOptions = {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Key ' + PAT
    },
    body: raw
  };

  try {
    const response = await fetch("https://api.clarifai.com/v2/models/general-image-recognition/outputs", requestOptions);
    const result = await response.json();
    console.log(result.status.description);
  } catch (error) {
    console.log('error', error);
  }
}

testClarifaiREST();
