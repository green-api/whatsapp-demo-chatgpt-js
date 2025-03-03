# Демонстрационный чат-бот WhatsApp GPT

Комплексный демонстрационный чат-бот, показывающий возможности и функции
библиотеки [@green-api/whatsapp-chatgpt](https://github.com/green-api/whatsapp-chatgpt-js).

## Обзор

Этот демо-бот показывает, как создать многофункциональный WhatsApp-чат-бот на основе моделей OpenAI GPT. Он включает
примеры реализации промежуточного ПО (middleware), пользовательских обработчиков сообщений, обработки команд и многое
другое.

## Функции

- 🤖 Интеграция с OpenAI GPT с настраиваемыми моделями
- 🌐 Поддержка нескольких языков (автоматически отвечает на языке пользователя)
- 🖼️ Пользовательская обработка изображений
- 🔄 Несколько примеров промежуточного ПО (Middleware)
- ⌨️ Система обработки команд
- 🧩 Обработка сообщений по типам
- 📝 Простой пример модерации контента
- 🌦️ Демонстрационные интеграции (имитация API погоды)
- 🎭 Несколько режимов личности

## Настройка

### Предварительные требования

- Node.js 20.0.0 или выше
- Аккаунт GREEN-API и инстанс ([зарегистрироваться здесь](https://green-api.com/))
- Ключ API OpenAI ([получить здесь](https://platform.openai.com/api-keys))

### Установка

1. Склонируйте репозиторий:
   ```bash
   git clone https://github.com/green-api/whatsapp-demo-chatgpt-js.git
   cd whatsapp-demo-chatgpt-js
   ```

2. Установите зависимости:
   ```bash
   npm install
   ```

3. Создайте файл `.env` в корне проекта со следующим содержимым:
   ```
   INSTANCE_ID=ваш_идентификатор_инстанса_green_api
   INSTANCE_TOKEN=ваш_токен_инстанса_green_api
   OPENAI_API_KEY=ваш_ключ_api_openai
   ```

4. Запустите бота:
   ```bash
   npm start
   ```

   Для режима отладки с дополнительным логированием:
   ```bash
   npm run start:debug
   ```

## Архитектура бота

### Процесс обработки сообщений

Демо-бот использует настройку `handlersFirst: true`, которая устанавливает определенный процесс обработки сообщений:

1. Бот получает сообщение
2. Глобальные обработчики (onText, onRegex, onType) сначала пытаются обработать сообщение:
    - Если обработчик совпадает и **не** возвращает `true`, обработка останавливается на этом этапе (GPT не получает
      сообщение)
    - Если обработчик совпадает и возвращает `true`, обработка продолжается до GPT
    - Если ни один обработчик не совпадает с сообщением, обработка автоматически продолжается до GPT
3. Если обработка продолжается до GPT (либо потому, что ни один обработчик не совпал, либо обработчик явно вернул
   `true`), сообщение обрабатывается моделью GPT

Понимание этого процесса критически важно, поскольку:

- Обработчики команд, такие как `/help` и `/weather`, полностью обрабатывают сообщение и не передают его в GPT
- Обработчики типов (например, обработчик документов) могут обработать сообщение, а затем опционально передать его в
  GPT, вернув `true`
- Любое сообщение, не совпавшее с обработчиками, автоматически отправляется в GPT

Без установки `handlersFirst: true` все сообщения сначала бы передавались в GPT, что делает невозможным реализацию
команд и других хендлеров.

### Конфигурация

Бот настраивается с различными параметрами:

```typescript
const bot = new WhatsappGptBot({
	idInstance: process.env.INSTANCE_ID || "",
	apiTokenInstance: process.env.INSTANCE_TOKEN || "",
	openaiApiKey: process.env.OPENAI_API_KEY || "",
	model: "gpt-4o",
	systemMessage: "Всегда отвечай на языке, на котором пишет пользователь...",
	maxHistoryLength: 15,
	temperature: 0.5,
	handlersFirst: true,
	clearWebhookQueueOnStart: true,
});
```

### Пользовательские обработчики сообщений

Демонстрация реализует пользовательский обработчик изображений, который улучшает стандартное поведение:

```typescript
class EnhancedImageHandler extends ImageMessageHandler {
	async processMessage(message: Message, openai: OpenAI, model: OpenAIModel): Promise<any> {
		const result = await super.processMessage(message, openai, model);

		if (typeof result === "string") {
			return result.replace(
				"[The user sent an image",
				"[Пользователь отправил изображение. Скажите ему, что вы не та модель..."
			);
		}

		return result;
	}
}

// Регистрация пользовательского обработчика
bot.replaceHandler(ImageMessageHandler, new EnhancedImageHandler());
```

### Примеры промежуточного ПО (Middleware)

Демонстрация включает несколько примеров промежуточного ПО, показывающих различные возможности:

#### Промежуточное ПО для логирования

```typescript
const loggingMessageMiddleware: ProcessMessageMiddleware = async (
	message, messageContent, messages, _
) => {
	console.log(`[${new Date().toISOString()}] Пользователь (${message.chatId}): `,
		typeof messageContent === "string"
			? messageContent
			: JSON.stringify(messageContent));

	return {messageContent, messages};
};

bot.addMessageMiddleware(loggingMessageMiddleware);
```

#### Промежуточное ПО для расширения контекста

```typescript
const timeContextMiddleware: ProcessMessageMiddleware = async (
	_, messageContent, messages, __
) => {
	const systemIndex = messages.findIndex(m => m.role === "system");
	if (systemIndex >= 0 && typeof messages[systemIndex].content === "string") {
		const now = new Date();
		const timeContext = `Текущее время: ${now.toLocaleString()}`;

		// Добавление или обновление контекста времени в системном сообщении
		// ...
	}

	return {messageContent, messages};
};

bot.addMessageMiddleware(timeContextMiddleware);
```

#### Промежуточное ПО для модерации контента

```typescript
const moderationMiddleware: ProcessMessageMiddleware = async (
	_, messageContent, messages, __
) => {
	const sensitiveKeywords = [
		"stupid", "bad", "awful",
	];

	if (typeof messageContent === "string") {
		// Проверка на наличие чувствительных ключевых слов и их пометка при необходимости
		// ...
	}

	return {messageContent, messages};
};

bot.addMessageMiddleware(moderationMiddleware);
```

#### Промежуточное ПО для подписи ответов

```typescript
const signatureMiddleware: ProcessResponseMiddleware = async (
	response, messages, _
) => {
	const signature = "— GREEN-API WhatsApp GPT бот";

	// Добавление подписи к ответам
	// ...

	return {
		response: enhancedResponse,
		messages
	};
};

bot.addResponseMiddleware(signatureMiddleware);
```

## Обработчики команд

Демонстрация реализует несколько обработчиков команд для демонстрации системы обработки команд:

### Команда помощи

```typescript
bot.onText("/help", async (message, _) => {
	const helpText = `*Демо-бот WhatsAppGPT*

Доступные команды:
- /help - Показать это сообщение помощи
- /clear - Очистить историю разговора
- /mode [professional|casual|creative] - Изменить стиль ответов
- /weather [местоположение] - Получить информацию о погоде (демо)
...`;

	await bot.sendText(message.chatId, helpText);
});
```

### Управление историей

```typescript
bot.onText("/clear", async (message, session) => {
	// Сохранить только системное сообщение
	if (session.stateData && session.stateData.messages) {
		const systemMessage = session.stateData.messages.find(m => m.role === "system");
		session.stateData.messages = systemMessage ? [systemMessage] : [];
		await bot.sendText(message.chatId, "✓ История разговора очищена!");
	} else {
		await bot.sendText(message.chatId, "Нет истории разговора для очистки.");
	}
});
```

### Переключение режима личности

```typescript
bot.onRegex(/^\/mode\s+(professional|casual)$/i, async (message, session) => {
	// Извлечение режима из команды
	// ...

	// Обновление системной подсказки в зависимости от выбранного режима
	// ...

	await bot.sendText(message.chatId, `Режим переключен на стиль *${mode}*! 🎭`);
});
```

### Демо-команда погоды

```typescript
bot.onRegex(/^\/weather\s+(.+)$/i, async (message, _) => {
	// Извлечение местоположения из команды
	// ...

	// Имитация вызова API погоды
	// ...

	await bot.sendText(
		message.chatId,
		`*Погода для ${weather.location}*\n` +
		// Форматирование данных о погоде
		// ...
	);
});
```

## Обработчики типов

Демонстрация реализует обработчики для разных типов сообщений:

### Обработчик местоположения

```typescript
bot.onType("location", async (message, _) => {
	if (!message.location) return;

	// Извлечение данных о местоположении
	// ...

	// Имитация ближайших мест
	// ...

	await bot.sendText(message.chatId, response);
});
```

### Обработчик документов

```typescript
bot.onType("document", async (message, _) => {
	if (!message.media) return;

	const fileName = message.media.fileName || "неизвестный файл";

	await bot.sendText(
		message.chatId,
		`Я получил ваш документ: "${fileName}"\n\n_Примечание: Это демонстрация..._`
	);
	return true;
});
```

## Запуск бота

Запуск бота обрабатывается с правильной обработкой ошибок и корректным завершением:

```typescript
console.log("Запуск демо-бота WhatsApp GPT...");
bot.start().then(() => {
	console.log("Бот успешно запущен!");
}).catch(error => {
	console.error("Не удалось запустить бота:", error);
});

process.on("SIGINT", () => {
	console.log("Остановка бота...");
	bot.stop();
	process.exit(0);
});
```

## Расширение демонстрации

Вы можете использовать эту демонстрацию как отправную точку для вашего собственного WhatsApp GPT бота. Вот несколько
предложений по расширению:

### Добавление новых команд

Чтобы добавить новую команду, используйте методы `onText` или `onRegex`:

```typescript
bot.onText("/mycommand", async (message, session) => {
	// Ваша логика команды здесь
	await bot.sendText(message.chatId, "Ответ на мою команду");
});
```

### Создание нового промежуточного ПО

Чтобы добавить новое промежуточное ПО, создайте функцию, реализующую интерфейс `ProcessMessageMiddleware` или
`ProcessResponseMiddleware`:

```typescript
const myMiddleware: ProcessMessageMiddleware = async (
	message, messageContent, messages, sessionData
) => {
	// Ваша логика промежуточного ПО здесь
	return {messageContent, messages};
};

bot.addMessageMiddleware(myMiddleware);
```

### Добавление пользовательских обработчиков сообщений

Для обработки новых типов сообщений или изменения существующих обработчиков:

```typescript
class MyCustomHandler implements MessageHandler {
	canHandle(message: Message): boolean {
		// Определите, может ли этот обработчик обработать сообщение
		return message.type === "my-custom-type";
	}

	async processMessage(message: Message): Promise<any> {
		// Обработка сообщения
		return "Обработанный контент";
	}
}

bot.registerMessageHandler(new MyCustomHandler());
```

## Лицензия

Этот проект лицензирован по лицензии [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/).
