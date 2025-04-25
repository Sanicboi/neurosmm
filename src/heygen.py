from os import getenv
import requests



    


class HeyGen:
    def __init__(self):
        self._token = getenv("HEYGEN_TOKEN")

    

    def get_avatars(self):
        res = requests.get("https://api.heygen.com/v2/avatars", headers={
            'X-Api-Key': self._token
        })
        data = res.json()
        return data['data']['avatars']

    def generate_video(self, avatar_id, voice_id, avatar_style="normal", voice_type="text", voice_text="", speed=1.0, caption=False, callback_id = None):
        res = requests.post("https://api.heygen.com/v2/video/generate", json={
            "video_inputs": [
                {
                    "character": {
                        "type": "avatar",
                        "avatar_id": avatar_id,
                        "avatar_style": avatar_style
                    },
                    "voice": {
                        "type": "text",
                        "input_text": voice_text,
                        "voice_id": voice_id,
                        "speed": speed
                    } if voice_type == "text" else {
                        "type": "audio",
                        "audio_asset_id": voice_id,
                    }
                }
            ],
            "dimension": {
                "width": 720,
                "height": 1280
            },
            "caption": caption,
            "callback_id": callback_id
        }, headers={
            'X-Api-Key': self._token,
            'Content-Type': 'application/json'
        })
        print(res.status_code)

