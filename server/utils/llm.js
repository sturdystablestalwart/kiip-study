const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const parseTextWithLLM = async (text) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
        You are an expert KIIP (Korea Immigration and Integration Program) Level 2 instructor.
        Your task is to parse the following text and convert it into a structured practice test.
        The text might be raw study material or an existing mock test.

        REQUIREMENTS:
        1. Generate exactly 20 questions if possible.
        2. Questions must be multiple-choice with 4 options each.
        3. Include a helpful explanation for each answer IN ENGLISH.
        4. If the text mentions images like "[Image 1]" or "q1.jpg", include the filename in the "image" field.
        5. Point spread: Vocabulary/Grammar (Questions 1-10) are usually 4 points each, Reading (11-20) are 6 points each (or adjust to fit KIIP standard total of 100).
        6. The output MUST be a valid JSON object matching this structure:
        {
          "title": "A descriptive title for the test",
          "questions": [
            {
              "text": "The question text (in Korean)",
              "options": [
                { "text": "Option 1", "isCorrect": false },
                { "text": "Option 2", "isCorrect": true },
                { "text": "Option 3", "isCorrect": false },
                { "text": "Option 4", "isCorrect": false }
              ],
              "explanation": "Why the correct answer is right (IN ENGLISH)",
              "type": "mcq-single",
              "image": "optional_filename.jpg"
            }
          ]
        }

        TEXT TO PARSE:
        ${text}

        Respond ONLY with the JSON object.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const parsed = JSON.parse(jsonText);

        // Validate that we have at least 1 question
        if (!parsed.questions || parsed.questions.length === 0) {
            throw new Error('AI generated no valid questions. Please provide more content.');
        }

        return parsed;
    } catch (err) {
        console.error("LLM Parsing Error:", err);
        throw new Error("Failed to parse text with AI: " + err.message);
    }
};

module.exports = { parseTextWithLLM };
