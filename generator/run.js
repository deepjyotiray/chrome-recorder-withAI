const { sendPrompt } = require('./sendPromptRequest');

const prompt = `Use the following C# file as a reference Page Object Model (POM) pattern. It is built using the CSOD automation framework and follows structured patterns...`; // 🔁 Replace with full prompt

const task = 'Provide reference structure for CSOD-based POM';

sendPrompt(prompt, task);
