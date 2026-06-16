const myHeaders = new Headers();
myHeaders.append("Authorization", "App 11b64efc8a330f3933db9f5567a28948-82c371f1-b4ea-492f-a4f7-722d47c0e853");
myHeaders.append("Content-Type", "application/json");
myHeaders.append("Accept", "application/json");

const raw = JSON.stringify({
    "messages": [
        {
            "from": "447860088970",
            "to": "916381265885",
            "messageId": "32b9832e-9ff5-44b1-ac03-3bf92cdb6cf4",
            "content": {
                "templateName": "test_whatsapp_template_en",
                "templateData": {
                    "body": {
                        "placeholders": ["IWMS"]
                    }
                },
                "language": "en"
            }
        }
    ]
});

const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow"
};

fetch("https://9jk8m3.api.infobip.com/whatsapp/1/message/template", requestOptions)
    .then((response) => response.text())
    .then((result) => console.log(result))
    .catch((error) => console.error(error));