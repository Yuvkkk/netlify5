const fetch = require("node-fetch");

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const token = event.headers.authorization?.split(" ")[1];
  if (token !== process.env.API_TOKEN) {
    console.error("授权失败: 无效的 token");
    return { statusCode: 403, body: JSON.stringify({ message: "Unauthorized" }) };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ message: "Method Not Allowed" }) };
  }

  const tempUrl = event.queryStringParameters.tempUrl;
  if (!tempUrl) {
    return { statusCode: 400, body: JSON.stringify({ message: "Missing tempUrl" }) };
  }

  try {
    const range = event.headers.range;
    const fileResponse = await fetch(tempUrl, {
      headers: { ...(range && { Range: range }) },
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
  } catch (error) {
    console.error("处理失败:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error downloading file", error: error.message }),
    };
  }
};
