export default function generateLambdaProxyResponse(
  httpCode: number,
  jsonBody: string,
) {
  return {
    body: jsonBody,
    statusCode: httpCode,
    headers: {
      "Content-Type": "application/json",
    },
  };
}
