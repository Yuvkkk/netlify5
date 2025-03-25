const fetch = require("node-fetch");
const crypto = require("crypto");

const accountId = process.env.B2_ACCOUNT_ID;
const applicationKey = process.env.B2_APPLICATION_KEY;
const authUrl = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account";
const SECRET_KEY = process.env.SECRET_KEY || "my-secret-key"; // 用于签名的密钥，需在环境变量中设置

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const token = event.headers.authorization?.split(" ")[1];
  if (token !== process.env.API_TOKEN) {
    console.error("授权失败: 无效的 token");
    return { statusCode: 403, body: JSON.stringify({ message: "Unauthorized" }) };
  }

  try {
    // 获取 B2 授权令牌
    const authResponse = await fetch(authUrl, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountId}:${applicationKey}`).toString("base64"),
      },
    });
    const authData = await authResponse.json();
    if (!authResponse.ok) throw new Error(`授权失败: ${JSON.stringify(authData)}`);
    const { authorizationToken, apiUrl } = authData;

    if (event.httpMethod === "GET" && event.queryStringParameters?.url) {
      // 下载文件逻辑
      const fileUrl = event.queryStringParameters.url;
      const range = event.headers.range;

      const fileResponse = await fetch(fileUrl, {
        headers: { Authorization: authorizationToken, ...(range && { Range: range }) },
      });
      if (!fileResponse.ok) throw new Error(`下载文件失败: ${fileResponse.statusText}`);

      const fileBuffer = await fileResponse.buffer();
      console.log(`文件下载成功，大小: ${fileBuffer.length} 字节`);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/octet-stream" },
        isBase64Encoded: true,
        body: fileBuffer.toString("base64"),
      };
    } else if (event.httpMethod === "POST") {
      // 生成限时链接逻辑
      const body = JSON.parse(event.body || "{}");
      const fileUrl = body.fileUrl;
      if (!fileUrl) throw new Error("缺少 fileUrl");

      const expires = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 小时后过期
      const signature = crypto
        .createHmac("sha256", SECRET_KEY)
        .update(`${fileUrl}${expires}`)
        .digest("hex");

      const tempUrl = `/.netlify/functions/download-file?url=${encodeURIComponent(fileUrl)}&expires=${expires}&signature=${signature}`;
      console.log("生成限时链接:", tempUrl);

      return {
        statusCode: 200,
        body: JSON.stringify({ tempUrl: `https://your-site.netlify.app${tempUrl}` }),
      };
    }

    return { statusCode: 400, body: JSON.stringify({ message: "Invalid request" }) };
  } catch (error) {
    console.error("处理失败:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error processing request", error: error.message }),
    };
  }
};
