INSERT INTO "generation_provider" ("id", "name")
VALUES
	('byteplus', 'BytePlus'),
	('kling', 'Kling')
ON CONFLICT ("id") DO UPDATE SET
	"name" = excluded."name",
	"updated_at" = now();--> statement-breakpoint
INSERT INTO "generation_model" ("id", "provider_id", "display_name", "type", "status")
VALUES
	('seedance-2.0-video', 'byteplus', 'Seedance 2.0', 'video', 'published'),
	('kling-v3-text-to-video', 'kling', 'Kling 3.0 Text to Video', 'video', 'published')
ON CONFLICT ("id") DO UPDATE SET
	"provider_id" = excluded."provider_id",
	"display_name" = excluded."display_name",
	"type" = excluded."type",
	"status" = excluded."status",
	"updated_at" = now();--> statement-breakpoint
INSERT INTO "generation_model_spec" (
	"id",
	"model_id",
	"version",
	"schema_version",
	"status",
	"spec",
	"published_at"
)
VALUES
	(
		'seedance-2.0-video-v1',
		'seedance-2.0-video',
		1,
		1,
		'published',
		$json${
  "schemaVersion": 1,
  "id": "seedance-2.0-video",
  "provider": "byteplus",
  "providerModelId": "dreamina-seedance-2-0-260128",
  "displayName": "Seedance 2.0",
  "description": "BytePlus ModelArk Seedance 2.0 video generation.",
  "type": "video",
  "status": "published",
  "sourceUrls": [
    "https://docs.byteplus.com/en/docs/ModelArk/1520757"
  ],
  "endpoint": {
    "method": "POST",
    "path": "/api/v3/contents/generations/tasks"
  },
  "modelParameter": {
    "path": [
      "model"
    ],
    "source": "spec"
  },
  "fields": [
    {
      "id": "prompt",
      "label": "Prompt",
      "componentKind": "promptTextarea",
      "valueKind": "string",
      "required": false,
      "advanced": false,
      "defaultValue": "",
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "maxLength": 10000,
      "notes": [
        "Seedance recommends prompts under 1000 words."
      ]
    },
    {
      "id": "images",
      "label": "Images",
      "componentKind": "mediaList",
      "valueKind": "array",
      "required": false,
      "advanced": false,
      "defaultValue": [],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": [
        "Use role first_frame, last_frame, or reference_image.",
        "Reference images are Seedance 2.0-only and support up to 9 images."
      ]
    },
    {
      "id": "videos",
      "label": "Videos",
      "componentKind": "mediaList",
      "valueKind": "array",
      "required": false,
      "advanced": false,
      "defaultValue": [],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": [
        "Use role reference_video. Seedance 2.0 supports up to 3 videos."
      ]
    },
    {
      "id": "audios",
      "label": "Audio",
      "componentKind": "mediaList",
      "valueKind": "array",
      "required": false,
      "advanced": false,
      "defaultValue": [],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": [
        "Use role reference_audio. Audio cannot be submitted without an image or video reference."
      ]
    },
    {
      "id": "draftTaskId",
      "label": "Draft task ID",
      "componentKind": "textInput",
      "valueKind": "string",
      "required": false,
      "advanced": true,
      "defaultValue": "",
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": [
        "Draft-task input is documented for Seedance 1.5 Pro."
      ]
    },
    {
      "id": "resolution",
      "label": "Resolution",
      "componentKind": "select",
      "valueKind": "string",
      "required": false,
      "advanced": false,
      "defaultValue": "720p",
      "providerPath": [
        "resolution"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "options": [
        {
          "label": "480p",
          "value": "480p"
        },
        {
          "label": "720p",
          "value": "720p"
        },
        {
          "label": "1080p",
          "value": "1080p"
        }
      ],
      "notes": []
    },
    {
      "id": "aspectRatio",
      "label": "Aspect ratio",
      "componentKind": "select",
      "valueKind": "string",
      "required": false,
      "advanced": false,
      "defaultValue": "adaptive",
      "providerPath": [
        "ratio"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "options": [
        {
          "label": "Adaptive",
          "value": "adaptive"
        },
        {
          "label": "16:9",
          "value": "16:9"
        },
        {
          "label": "4:3",
          "value": "4:3"
        },
        {
          "label": "1:1",
          "value": "1:1"
        },
        {
          "label": "3:4",
          "value": "3:4"
        },
        {
          "label": "9:16",
          "value": "9:16"
        },
        {
          "label": "21:9",
          "value": "21:9"
        }
      ],
      "notes": []
    },
    {
      "id": "duration",
      "label": "Duration",
      "componentKind": "select",
      "valueKind": "integer",
      "required": false,
      "advanced": false,
      "defaultValue": 5,
      "providerPath": [
        "duration"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "min": -1,
      "max": 15,
      "options": [
        {
          "label": "Adaptive",
          "value": -1
        },
        {
          "label": "4s",
          "value": 4
        },
        {
          "label": "5s",
          "value": 5
        },
        {
          "label": "6s",
          "value": 6
        },
        {
          "label": "7s",
          "value": 7
        },
        {
          "label": "8s",
          "value": 8
        },
        {
          "label": "9s",
          "value": 9
        },
        {
          "label": "10s",
          "value": 10
        },
        {
          "label": "11s",
          "value": 11
        },
        {
          "label": "12s",
          "value": 12
        },
        {
          "label": "13s",
          "value": 13
        },
        {
          "label": "14s",
          "value": 14
        },
        {
          "label": "15s",
          "value": 15
        }
      ],
      "notes": [
        "Seedance 2.0 supports integer duration 4-15 seconds, or -1 for adaptive."
      ]
    },
    {
      "id": "generateAudio",
      "label": "Generate audio",
      "componentKind": "toggle",
      "valueKind": "boolean",
      "required": false,
      "advanced": false,
      "defaultValue": true,
      "providerPath": [
        "generate_audio"
      ],
      "options": [
        {
          "label": "On",
          "value": true
        },
        {
          "label": "Off",
          "value": false
        }
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": true,
      "notes": []
    },
    {
      "id": "watermark",
      "label": "Watermark",
      "componentKind": "toggle",
      "valueKind": "boolean",
      "required": false,
      "advanced": false,
      "defaultValue": false,
      "providerPath": [
        "watermark"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": true,
      "notes": []
    },
    {
      "id": "seed",
      "label": "Seed",
      "componentKind": "numberInput",
      "valueKind": "integer",
      "required": false,
      "advanced": true,
      "defaultValue": -1,
      "providerPath": [
        "seed"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": true,
      "min": -1,
      "max": 4294967295,
      "notes": []
    },
    {
      "id": "returnLastFrame",
      "label": "Return last frame",
      "componentKind": "toggle",
      "valueKind": "boolean",
      "required": false,
      "advanced": true,
      "defaultValue": false,
      "providerPath": [
        "return_last_frame"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": true,
      "notes": []
    },
    {
      "id": "priority",
      "label": "Priority",
      "componentKind": "slider",
      "valueKind": "integer",
      "required": false,
      "advanced": true,
      "defaultValue": 0,
      "providerPath": [
        "priority"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": true,
      "min": 0,
      "max": 9,
      "notes": []
    },
    {
      "id": "safetyIdentifier",
      "label": "Safety identifier",
      "componentKind": "textInput",
      "valueKind": "string",
      "required": false,
      "advanced": true,
      "defaultValue": "",
      "providerPath": [
        "safety_identifier"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "maxLength": 64,
      "notes": []
    },
    {
      "id": "callbackUrl",
      "label": "Callback URL",
      "componentKind": "textInput",
      "valueKind": "string",
      "required": false,
      "advanced": true,
      "defaultValue": "",
      "providerPath": [
        "callback_url"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": []
    },
    {
      "id": "executionExpiresAfter",
      "label": "Execution expiry",
      "componentKind": "numberInput",
      "valueKind": "integer",
      "required": false,
      "advanced": true,
      "defaultValue": 172800,
      "providerPath": [
        "execution_expires_after"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": true,
      "min": 3600,
      "max": 259200,
      "notes": []
    },
    {
      "id": "serviceTier",
      "label": "Service tier",
      "componentKind": "select",
      "valueKind": "string",
      "required": false,
      "advanced": true,
      "defaultValue": "default",
      "providerPath": [
        "service_tier"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": true,
      "options": [
        {
          "label": "Default",
          "value": "default"
        },
        {
          "label": "Flex",
          "value": "flex"
        }
      ],
      "notes": [
        "Seedance 2.0 supports only online inference."
      ]
    },
    {
      "id": "draft",
      "label": "Draft mode",
      "componentKind": "toggle",
      "valueKind": "boolean",
      "required": false,
      "advanced": true,
      "defaultValue": false,
      "providerPath": [
        "draft"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": true,
      "notes": [
        "Draft mode is documented for Seedance 1.5 Pro, not Seedance 2.0."
      ]
    },
    {
      "id": "frames",
      "label": "Frames",
      "componentKind": "numberInput",
      "valueKind": "integer",
      "required": false,
      "advanced": true,
      "providerPath": [
        "frames"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": [
        "Frame count is not supported by Seedance 2.0."
      ]
    },
    {
      "id": "cameraFixed",
      "label": "Fixed camera",
      "componentKind": "toggle",
      "valueKind": "boolean",
      "required": false,
      "advanced": true,
      "defaultValue": false,
      "providerPath": [
        "camera_fixed"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": true,
      "notes": [
        "Fixed camera is not currently supported by Seedance 2.0."
      ]
    }
  ],
  "groups": [
    {
      "id": "prompt",
      "label": "Prompt",
      "fieldIds": [
        "prompt"
      ],
      "advanced": false
    },
    {
      "id": "references",
      "label": "References",
      "fieldIds": [
        "images",
        "videos",
        "audios",
        "draftTaskId"
      ],
      "advanced": false
    },
    {
      "id": "output",
      "label": "Output",
      "fieldIds": [
        "resolution",
        "aspectRatio",
        "duration",
        "generateAudio",
        "watermark"
      ],
      "advanced": false
    },
    {
      "id": "advanced",
      "label": "Advanced",
      "fieldIds": [
        "seed",
        "returnLastFrame",
        "priority",
        "safetyIdentifier",
        "callbackUrl",
        "executionExpiresAfter",
        "serviceTier",
        "draft",
        "frames",
        "cameraFixed"
      ],
      "advanced": true
    }
  ],
  "transforms": [
    {
      "kind": "seedanceContentArray"
    }
  ],
  "validationRules": [
    "seedance20ContentRules"
  ]
}$json$::jsonb,
		now()
	),
	(
		'kling-v3-text-to-video-v1',
		'kling-v3-text-to-video',
		1,
		1,
		'published',
		$json${
  "schemaVersion": 1,
  "id": "kling-v3-text-to-video",
  "provider": "kling",
  "providerModelId": "kling-v3",
  "displayName": "Kling 3.0 Text to Video",
  "description": "Kling 3.0 text-to-video generation.",
  "type": "video",
  "status": "published",
  "sourceUrls": [
    "https://kling.ai/document-api/apiReference/model/textToVideo"
  ],
  "endpoint": {
    "method": "POST",
    "path": "/v1/videos/text2video"
  },
  "modelParameter": {
    "path": [
      "model_name"
    ],
    "source": "spec"
  },
  "fields": [
    {
      "id": "prompt",
      "label": "Prompt",
      "componentKind": "promptTextarea",
      "valueKind": "string",
      "required": false,
      "advanced": false,
      "defaultValue": "",
      "providerPath": [
        "prompt"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "maxLength": 2500,
      "notes": [
        "Required when multi-shot is disabled, or when intelligent multi-shot is selected."
      ]
    },
    {
      "id": "negativePrompt",
      "label": "Negative prompt",
      "componentKind": "textarea",
      "valueKind": "string",
      "required": false,
      "advanced": false,
      "defaultValue": "",
      "providerPath": [
        "negative_prompt"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "maxLength": 2500,
      "notes": []
    },
    {
      "id": "multiShot",
      "label": "Multi-shot",
      "componentKind": "toggle",
      "valueKind": "boolean",
      "required": false,
      "advanced": false,
      "defaultValue": false,
      "providerPath": [
        "multi_shot"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": []
    },
    {
      "id": "shotType",
      "label": "Shot type",
      "componentKind": "select",
      "valueKind": "string",
      "required": false,
      "advanced": false,
      "defaultValue": "",
      "providerPath": [
        "shot_type"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "options": [
        {
          "label": "Custom",
          "value": "customize"
        },
        {
          "label": "Intelligent",
          "value": "intelligence"
        }
      ],
      "notes": []
    },
    {
      "id": "multiPrompt",
      "label": "Storyboard prompts",
      "componentKind": "storyboardList",
      "valueKind": "array",
      "required": false,
      "advanced": false,
      "defaultValue": [],
      "providerPath": [
        "multi_prompt"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "arrayMax": 6,
      "notes": []
    },
    {
      "id": "generateAudio",
      "label": "Sound",
      "componentKind": "select",
      "valueKind": "boolean",
      "required": false,
      "advanced": false,
      "defaultValue": false,
      "providerPath": [
        "sound"
      ],
      "providerValueMap": [
        {
          "canonicalValue": true,
          "providerValue": "on"
        },
        {
          "canonicalValue": false,
          "providerValue": "off"
        }
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "options": [
        {
          "label": "On",
          "value": true
        },
        {
          "label": "Off",
          "value": false
        }
      ],
      "notes": []
    },
    {
      "id": "cfgScale",
      "label": "CFG scale",
      "componentKind": "slider",
      "valueKind": "number",
      "required": false,
      "advanced": true,
      "defaultValue": 0.5,
      "providerPath": [
        "cfg_scale"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "min": 0,
      "max": 1,
      "notes": []
    },
    {
      "id": "mode",
      "label": "Mode",
      "componentKind": "select",
      "valueKind": "string",
      "required": false,
      "advanced": false,
      "defaultValue": "std",
      "providerPath": [
        "mode"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "options": [
        {
          "label": "Standard",
          "value": "std"
        },
        {
          "label": "Pro",
          "value": "pro"
        },
        {
          "label": "4K",
          "value": "4k"
        }
      ],
      "notes": []
    },
    {
      "id": "cameraControl",
      "label": "Camera control",
      "componentKind": "cameraControl",
      "valueKind": "object",
      "required": false,
      "advanced": true,
      "defaultValue": null,
      "providerPath": [
        "camera_control"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": []
    },
    {
      "id": "aspectRatio",
      "label": "Aspect ratio",
      "componentKind": "select",
      "valueKind": "string",
      "required": false,
      "advanced": false,
      "defaultValue": "16:9",
      "providerPath": [
        "aspect_ratio"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "options": [
        {
          "label": "16:9",
          "value": "16:9"
        },
        {
          "label": "9:16",
          "value": "9:16"
        },
        {
          "label": "1:1",
          "value": "1:1"
        }
      ],
      "notes": []
    },
    {
      "id": "duration",
      "label": "Duration",
      "componentKind": "select",
      "valueKind": "integer",
      "required": false,
      "advanced": false,
      "defaultValue": 5,
      "providerPath": [
        "duration"
      ],
      "providerValueMap": [
        {
          "canonicalValue": 3,
          "providerValue": "3"
        },
        {
          "canonicalValue": 4,
          "providerValue": "4"
        },
        {
          "canonicalValue": 5,
          "providerValue": "5"
        },
        {
          "canonicalValue": 6,
          "providerValue": "6"
        },
        {
          "canonicalValue": 7,
          "providerValue": "7"
        },
        {
          "canonicalValue": 8,
          "providerValue": "8"
        },
        {
          "canonicalValue": 9,
          "providerValue": "9"
        },
        {
          "canonicalValue": 10,
          "providerValue": "10"
        },
        {
          "canonicalValue": 11,
          "providerValue": "11"
        },
        {
          "canonicalValue": 12,
          "providerValue": "12"
        },
        {
          "canonicalValue": 13,
          "providerValue": "13"
        },
        {
          "canonicalValue": 14,
          "providerValue": "14"
        },
        {
          "canonicalValue": 15,
          "providerValue": "15"
        }
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "min": 3,
      "max": 15,
      "options": [
        {
          "label": "3s",
          "value": 3
        },
        {
          "label": "4s",
          "value": 4
        },
        {
          "label": "5s",
          "value": 5
        },
        {
          "label": "6s",
          "value": 6
        },
        {
          "label": "7s",
          "value": 7
        },
        {
          "label": "8s",
          "value": 8
        },
        {
          "label": "9s",
          "value": 9
        },
        {
          "label": "10s",
          "value": 10
        },
        {
          "label": "11s",
          "value": 11
        },
        {
          "label": "12s",
          "value": 12
        },
        {
          "label": "13s",
          "value": 13
        },
        {
          "label": "14s",
          "value": 14
        },
        {
          "label": "15s",
          "value": 15
        }
      ],
      "notes": []
    },
    {
      "id": "callbackUrl",
      "label": "Callback URL",
      "componentKind": "textInput",
      "valueKind": "string",
      "required": false,
      "advanced": true,
      "defaultValue": "",
      "providerPath": [
        "callback_url"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": []
    },
    {
      "id": "externalTaskId",
      "label": "External task ID",
      "componentKind": "textInput",
      "valueKind": "string",
      "required": false,
      "advanced": true,
      "defaultValue": "",
      "providerPath": [
        "external_task_id"
      ],
      "omitWhenEmpty": true,
      "omitWhenDefault": false,
      "notes": []
    }
  ],
  "groups": [
    {
      "id": "prompt",
      "label": "Prompt",
      "fieldIds": [
        "prompt",
        "negativePrompt"
      ],
      "advanced": false
    },
    {
      "id": "storyboard",
      "label": "Storyboard",
      "fieldIds": [
        "multiShot",
        "shotType",
        "multiPrompt"
      ],
      "advanced": false
    },
    {
      "id": "output",
      "label": "Output",
      "fieldIds": [
        "mode",
        "duration",
        "aspectRatio",
        "generateAudio"
      ],
      "advanced": false
    },
    {
      "id": "advanced",
      "label": "Advanced",
      "fieldIds": [
        "cfgScale",
        "cameraControl",
        "callbackUrl",
        "externalTaskId"
      ],
      "advanced": true
    }
  ],
  "transforms": [],
  "validationRules": [
    "klingTextToVideoRules"
  ]
}$json$::jsonb,
		now()
	)
ON CONFLICT ("model_id", "version") DO UPDATE SET
	"id" = excluded."id",
	"schema_version" = excluded."schema_version",
	"status" = excluded."status",
	"spec" = excluded."spec",
	"published_at" = excluded."published_at",
	"updated_at" = now();
