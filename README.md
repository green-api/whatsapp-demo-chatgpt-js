# WhatsApp GPT Demo Chatbot

A comprehensive demo chatbot showcasing the features and capabilities of
the [@green-api/whatsapp-chatgpt](https://github.com/green-api/whatsapp-chatgpt-js) library.

## Overview

This demo bot demonstrates how to build a feature-rich WhatsApp chatbot powered by OpenAI's GPT models. It includes
examples of middleware implementation, custom message handlers, command processing, and more.

## Features

- 🤖 OpenAI GPT integration with configurable models
- 🌐 Multi-language support (automatically responds in the user's language)
- 🖼️ Custom image processing
- 🔄 Multiple middleware examples
- ⌨️ Command handling system
- 🧩 Type-specific message handling
- 📝 Simple example of content moderation
- 🌦️ Demo integrations (simulated weather API)
- 🎭 Multiple personality modes

## Setup

### Prerequisites

- Node.js 20.0.0 or higher
- GREEN-API account and instance ([sign up here](https://green-api.com/))
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/green-api/whatsapp-demo-chatgpt-js.git
   cd whatsapp-demo-chatgpt-js
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following:
   ```
   INSTANCE_ID=your_green_api_instance_id
   INSTANCE_TOKEN=your_green_api_instance_token
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Start the bot:
   ```bash
   npm start
   ```

   For debug mode with additional logging:
   ```bash
   npm run start:debug
   ```

## Bot Architecture

### Message Processing Flow

The demo bot uses the `handlersFirst: true` configuration, which establishes a specific message processing flow:

1. Bot receives a message
2. Global handlers (onText, onRegex, onType) try to process the message first:
    - If a handler matches and **doesn't** return `true`, processing stops here (GPT doesn't receive the message)
    - If a handler matches and returns `true`, processing continues to GPT
    - If no handlers match the message, processing automatically continues to GPT
3. If processing continues to GPT (either because no handlers matched or a handler explicitly returned `true`), the
   message is processed by the GPT model

This flow is crucial to understand because:

- Command handlers like `/help` and `/weather` handle the message completely and don't pass it to GPT
- Type handlers (like the document handler) can process the message and then optionally pass it to GPT by returning
  `true`
- Any message not matched by handlers automatically goes to GPT

Without setting `handlersFirst: true`, all messages would first go to GPT, making it impossible to implement
command-based behavior.

### Configuration

The bot is configured with various options:

```typescript
const bot = new WhatsappGptBot({
	idInstance: process.env.INSTANCE_ID || "",
	apiTokenInstance: process.env.INSTANCE_TOKEN || "",
	openaiApiKey: process.env.OPENAI_API_KEY || "",
	model: "gpt-4o",
	systemMessage: "Always answer in a language the user uses to write to you...",
	maxHistoryLength: 15,
	temperature: 0.5,
	handlersFirst: true,
	clearWebhookQueueOnStart: true,
});
```

### Custom Message Handlers

The demo implements a custom image message handler that enhances the default behavior:

```typescript
class EnhancedImageHandler extends ImageMessageHandler {
	async processMessage(message: Message, openai: OpenAI, model: OpenAIModel): Promise<any> {
		const result = await super.processMessage(message, openai, model);

		if (typeof result === "string") {
			return result.replace(
				"[The user sent an image",
				"[The user sent an image. Tell them that you are not the model..."
			);
		}

		return result;
	}
}

// Register the custom handler
bot.replaceHandler(ImageMessageHandler, new EnhancedImageHandler());
```

### Middleware Examples

The demo includes several middleware examples to showcase different capabilities:

#### Logging Middleware

```typescript
const loggingMessageMiddleware: ProcessMessageMiddleware = async (
	message, messageContent, messages, _
) => {
	console.log(`[${new Date().toISOString()}] User (${message.chatId}): `,
		typeof messageContent === "string"
			? messageContent
			: JSON.stringify(messageContent));

	return {messageContent, messages};
};

bot.addMessageMiddleware(loggingMessageMiddleware);
```

#### Context Enhancement Middleware

```typescript
const timeContextMiddleware: ProcessMessageMiddleware = async (
	_, messageContent, messages, __
) => {
	const systemIndex = messages.findIndex(m => m.role === "system");
	if (systemIndex >= 0 && typeof messages[systemIndex].content === "string") {
		const now = new Date();
		const timeContext = `Current time: ${now.toLocaleString()}`;

		// Add or update time context in system message
		// ...
	}

	return {messageContent, messages};
};

bot.addMessageMiddleware(timeContextMiddleware);
```

#### Content Moderation Middleware

```typescript
const moderationMiddleware: ProcessMessageMiddleware = async (
	_, messageContent, messages, __
) => {
	const sensitiveKeywords = [
		"stupid", "bad", "awful",
	];

	if (typeof messageContent === "string") {
		// Check for sensitive keywords and flag if necessary
		// ...
	}

	return {messageContent, messages};
};

bot.addMessageMiddleware(moderationMiddleware);
```

#### Response Signature Middleware

```typescript
const signatureMiddleware: ProcessResponseMiddleware = async (
	response, messages, _
) => {
	const signature = "— GREEN-API WhatsApp GPT bot";

	// Add signature to responses
	// ...

	return {
		response: enhancedResponse,
		messages
	};
};

bot.addResponseMiddleware(signatureMiddleware);
```

## Command Handlers

The demo implements several command handlers to showcase the command handling system:

### Help Command

```typescript
bot.onText("/help", async (message, _) => {
	const helpText = `*WhatsAppGPT Demo Bot*

Available commands:
- /help - Show this help message
- /clear - Clear conversation history
- /mode [professional|casual|creative] - Change response style
- /weather [location] - Get weather info (demo)
...`;

	await bot.sendText(message.chatId, helpText);
});
```

### History Management

```typescript
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
```

### Personality Mode Switching

```typescript
bot.onRegex(/^\/mode\s+(professional|casual)$/i, async (message, session) => {
	// Extract mode from command
	// ...

	// Update system prompt based on selected mode
	// ...

	await bot.sendText(message.chatId, `Mode switched to *${mode}* style! 🎭`);
});
```

### Weather Demo Command

```typescript
bot.onRegex(/^\/weather\s+(.+)$/i, async (message, _) => {
	// Extract location from command
	// ...

	// Simulate weather API call
	// ...

	await bot.sendText(
		message.chatId,
		`*Weather for ${weather.location}*\n` +
		// Format weather data
		// ...
	);
});
```

## Type Handlers

The demo implements type-specific handlers for different message types:

### Location Handler

```typescript
bot.onType("location", async (message, _) => {
	if (!message.location) return;

	// Extract location data
	// ...

	// Simulate nearby places
	// ...

	await bot.sendText(message.chatId, response);
});
```

### Document Handler

```typescript
bot.onType("document", async (message, _) => {
	if (!message.media) return;

	const fileName = message.media.fileName || "unknown file";

	await bot.sendText(
		message.chatId,
		`I received your document: "${fileName}"\n\n_Note: This is a demonstration..._`
	);
	return true;
});
```

## Running the Bot

Starting the bot is handled with proper error handling and graceful shutdown:

```typescript
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
```

## Extending the Demo

You can use this demo as a starting point for your own WhatsApp GPT bot. Here are some suggestions for extending it:

### Adding New Commands

To add a new command, use the `onText` or `onRegex` methods:

```typescript
bot.onText("/mycommand", async (message, session) => {
	// Your command logic here
	await bot.sendText(message.chatId, "Response to my command");
});
```

### Creating New Middleware

To add new middleware, create a function implementing the `ProcessMessageMiddleware` or `ProcessResponseMiddleware`
interface:

```typescript
const myMiddleware: ProcessMessageMiddleware = async (
	message, messageContent, messages, sessionData
) => {
	// Your middleware logic here
	return {messageContent, messages};
};

bot.addMessageMiddleware(myMiddleware);
```

### Adding Custom Message Handlers

To handle new message types or modify existing handlers:

```typescript
class MyCustomHandler implements MessageHandler {
	canHandle(message: Message): boolean {
		// Determine if this handler can process the message
		return message.type === "my-custom-type";
	}

	async processMessage(message: Message): Promise<any> {
		// Process the message
		return "Processed content";
	}
}

bot.registerMessageHandler(new MyCustomHandler());
```

## License

This project is licensed under the [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) license.
