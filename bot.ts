import {
	GPTSessionData,
	ImageMessageHandler,
	ProcessMessageMiddleware,
	ProcessResponseMiddleware,
	WhatsappGptBot,
	OpenAIModel,
} from "@green-api/whatsapp-chatgpt";
import * as dotenv from "dotenv";
import { Message } from "@green-api/whatsapp-chatbot-js-v2";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import OpenAI from "openai";

dotenv.config();

// ============== CUSTOM MESSAGE HANDLERS ==============

/**
 * Better image description handler
 */
class EnhancedImageHandler extends ImageMessageHandler {
	async processMessage(message: Message, openai: OpenAI, model: OpenAIModel): Promise<any> {
		const result = await super.processMessage(message, openai, model);

		if (typeof result === "string") {
			return result.replace(
				"[The user sent an image",
				"[The user sent an image. Tell them that you are not the model they should be using and they should consider switching",
			);
		}

		return result;
	}
}

// ============== MIDDLEWARE ==============

/**
 * Message middleware that logs incoming messages
 */
const loggingMessageMiddleware: ProcessMessageMiddleware = async (
	message: Message,
	messageContent: any,
	messages: ChatCompletionMessageParam[],
	_: GPTSessionData,
): Promise<{
	messageContent: any;
	messages: ChatCompletionMessageParam[];
}> => {
	console.log(`[${new Date().toISOString()}] User (${message.chatId}): `,
		typeof messageContent === "string"
			? messageContent
			: JSON.stringify(messageContent));

	return {messageContent, messages};
};

/**
 * Response middleware that logs outgoing responses
 */
const loggingResponseMiddleware: ProcessResponseMiddleware = async (
	response: string,
	messages: ChatCompletionMessageParam[],
	_: GPTSessionData,
): Promise<{
	response: string;
	messages: ChatCompletionMessageParam[];
}> => {
	console.log(`[${new Date().toISOString()}] Bot: ${response}`);
	return {response, messages};
};

/**
 * Context enhancement middleware
 * Adds time context to the conversation
 */
const timeContextMiddleware: ProcessMessageMiddleware = async (
	_: Message,
	messageContent: any,
	messages: ChatCompletionMessageParam[],
	__: GPTSessionData,
): Promise<{
	messageContent: any;
	messages: ChatCompletionMessageParam[];
}> => {
	const systemIndex = messages.findIndex(m => m.role === "system");
	if (systemIndex >= 0 && typeof messages[systemIndex].content === "string") {
		const now = new Date();
		const timeContext = `Current time: ${now.toLocaleString()}`;

		const systemContent = messages[systemIndex].content;
		if (!systemContent.includes("Current time:")) {
			messages[systemIndex].content = `${systemContent}\n${timeContext}`;
		} else {
			messages[systemIndex].content = systemContent.replace(
				/Current time:.*$/m,
				timeContext,
			);
		}
	}

	return {messageContent, messages};
};

/**
 * Content moderation middleware
 * Checks for potentially inappropriate content
 */
const moderationMiddleware: ProcessMessageMiddleware = async (
	_: Message,
	messageContent: any,
	messages: ChatCompletionMessageParam[],
	__: GPTSessionData,
): Promise<{
	messageContent: any;
	messages: ChatCompletionMessageParam[];
}> => {
	const sensitiveKeywords = [
		"stupid", "bad", "awful",
	];

	if (typeof messageContent === "string") {
		const lowerContent = messageContent.toLowerCase();

		for (const keyword of sensitiveKeywords) {
			if (lowerContent.includes(keyword)) {
				console.log(`Moderation triggered on keyword: ${keyword}`);
				return {
					messageContent: "[This message was flagged by content moderation. Please use appropriate language.]",
					messages,
				};
			}
		}
	}

	return {messageContent, messages};
};

/**
 * Signature Middleware
 *
 * This middleware adds a signature at the end of each model message
 */
export const signatureMiddleware: ProcessResponseMiddleware = async (
	response: string,
	messages,
	_,
) => {
	const signature = "— GREEN-API WhatsApp GPT bot";

	if (response.includes(signature)) {
		return {
			response,
			messages,
		};
	}

	const enhancedResponse = `${response}\n\n${signature}`;

	return {
		response: enhancedResponse,
		messages,
	};
};

const bot = new WhatsappGptBot({
	idInstance: process.env.INSTANCE_ID || "",
	apiTokenInstance: process.env.INSTANCE_TOKEN || "",
	openaiApiKey: process.env.OPENAI_API_KEY || "",
	model: "gpt-4o",
	systemMessage: "Always answer in a language the user uses to write to you. You are a helpful WhatsApp assistant " +
		"created by a company GREEN-API, the best WhatsApp API provider, which allows you to send and receive " +
		"WhatsApp messages using their API. You can process text, images, and audio messages. Be concise but " +
		"informative in your responses.",
	maxHistoryLength: 15,
	temperature: 0.5,
	handlersFirst: true,
	clearWebhookQueueOnStart: true,
});

// ============== REGISTER COMMAND HANDLERS ==============

// Help command
bot.onText("/help", async (message, _) => {
	const helpText = `*WhatsAppGPT Demo Bot*

Available commands:
- /help - Show this help message
- /clear - Clear conversation history
- /mode [professional|casual|creative] - Change response style
- /weather [location] - Get weather info (demo)

You can also send:
- Text messages
- Images
- Audio messages
- Contacts
- Locations
- Documents

Your data is handled securely and conversations are private.`;

	await bot.sendText(message.chatId, helpText);
});

// Clear history command
bot.onText("/clear", async (message, session) => {
	// Keep only the system message
	if (session.stateData && session.stateData.messages) {
		const systemMessage = session.stateData.messages.find(m => m.role === "system");
		session.stateData.messages = systemMessage ? [systemMessage] : [];
		await bot.sendText(message.chatId, "✓ Conversation history cleared!");
	} else {
		await bot.sendText(message.chatId, "No conversation history to clear.");
	}
});

// Mode switching command
bot.onRegex(/^\/mode\s+(professional|casual)$/i, async (message, session) => {
	const match = message.text!.match(/^\/mode\s+(professional|casual)$/i);
	if (!match) return;

	const mode = match[1].toLowerCase();
	let systemPrompt = "";

	switch (mode) {
		case "professional":
			systemPrompt = "You must start every message with Mister or Missus or its equivalent in a user's language. " +
				"You are a professional assistant. Provide clear, factual, and detailed information. Use formal language " +
				"and be thorough but concise.";
			break;
		case "casual":
			systemPrompt = "You must start every message with Bro or Sis or its equivalent in a user's language. " +
				"You are a friendly and casual assistant. Keep your responses conversational, light, and easy to " +
				"understand. Feel free to use simple language and be a bit more relaxed.";
			break;
	}

	// Update the system message
	if (session.stateData && session.stateData.messages) {
		const systemIndex = session.stateData.messages.findIndex(m => m.role === "system");
		if (systemIndex >= 0) {
			session.stateData.messages[systemIndex].content = systemPrompt;
		} else {
			session.stateData.messages.unshift({role: "system", content: systemPrompt});
		}

		await bot.sendText(message.chatId, `Mode switched to *${mode}* style! 🎭`);
	}
});

// Weather command (simulated)
bot.onRegex(/^\/weather\s+(.+)$/i, async (message, _) => {
	const match = message.text!.match(/^\/weather\s+(.+)$/i);
	if (!match) return;

	const location = match[1];

	// Simulate weather API call
	const weather = {
		location,
		temperature: Math.round(10 + Math.random() * 25),
		condition: ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Heavy Rain"][Math.floor(Math.random() * 5)],
		humidity: Math.round(40 + Math.random() * 40),
		wind: Math.round(5 + Math.random() * 20),
	};

	await bot.sendText(
		message.chatId,
		`*Weather for ${weather.location}*\n` +
		`Temperature: ${weather.temperature}°C\n` +
		`Condition: ${weather.condition}\n` +
		`Humidity: ${weather.humidity}%\n` +
		`Wind: ${weather.wind} km/h\n\n` +
		`_Note: This is simulated data for demonstration purposes._`,
	);
});

// ============== TYPE HANDLERS ==============

// Location handler
bot.onType("location", async (message, _) => {
	if (!message.location) return;

	const {latitude, longitude, name} = message.location;
	const locationName = name || "this location";

	const nearbyPlaces = [
		"Coffee Shop (500m)",
		"Supermarket (1.2km)",
		"Park (800m)",
		"Restaurant (350m)",
		"Gas Station (1.5km)",
	];

	const selectedPlaces = [];
	for (let i = 0; i < 3; i++) {
		const randomIndex = Math.floor(Math.random() * nearbyPlaces.length);
		selectedPlaces.push(nearbyPlaces[randomIndex]);
		nearbyPlaces.splice(randomIndex, 1);
	}

	const response = `Thank you for sharing your location at ${locationName} (${latitude}, ${longitude}).\n\n` +
		`*Nearby Places:*\n• ${selectedPlaces.join("\n• ")}\n\n` +
		`_Note: These are simulated nearby places for demonstration purposes._`;

	await bot.sendText(message.chatId, response);
});

// Document "handler"
bot.onType("document", async (message, _) => {
	if (!message.media) return;

	const fileName = message.media.fileName || "unknown file";

	let fileType = "document";
	await bot.sendText(
		message.chatId,
		`I received your ${fileType}: "${fileName}"\n\n_Note: This is a demonstration of document handling capabilities._`,
	);
	return true;
});

// ============== REPLACE DEFAULT HANDLERS ==============

// Replace default image handler with enhanced version
bot.replaceHandler(ImageMessageHandler, new EnhancedImageHandler());

// ============== REGISTER MIDDLEWARE ==============

// Add logging middleware
bot.addMessageMiddleware(loggingMessageMiddleware);
bot.addResponseMiddleware(loggingResponseMiddleware);

// Add context middleware
bot.addMessageMiddleware(timeContextMiddleware);

// Add moderation middleware
bot.addMessageMiddleware(moderationMiddleware);

// Add signature middleware
bot.addResponseMiddleware(signatureMiddleware);

console.log("Starting WhatsApp GPT Demo Bot...");
bot.start().then(() => {
	console.log("Bot started successfully!");
}).catch(error => {
	console.error("Failed to start bot:", error);
});

process.on("SIGINT", () => {
	console.log("Stopping bot...");
	bot.stop();
	process.exit(0);
});
