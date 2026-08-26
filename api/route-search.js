import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  requestTimeout: 25000, // 25 second timeout for Lambda cold start
});

export const maxDuration = 30; // Vercel max duration in seconds

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    return res.status(200).end();
  }

  try {
    const body = req.body;
    const command = new InvokeCommand({
      FunctionName: "para-route-search",
      Payload: JSON.stringify(body),
    });
    const response = await lambdaClient.send(command);
    const payload = JSON.parse(Buffer.from(response.Payload).toString());
    const lambdaBody = JSON.parse(payload.body);
    
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(lambdaBody);
  } catch (error) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ error: error.message });
  }
}
