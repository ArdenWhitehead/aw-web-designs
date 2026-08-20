export default function handler(request, response) {

const apiKeyExists = Boolean(process.env.OPENAI_API_KEY);

response.status(200).json({
    apiKeyConfigured: apiKeyExists
});

}