/*!
 * A.max — AI Platform Registry & Selectors
 * Created by Arash Makki | Released under the MIT License
 */
(function (global) {
  'use strict';

  const AMTool = (global.AMTool = global.AMTool || {});

  const PLATFORMS = [
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      nameFa: 'چت‌جی‌پی‌تی (ChatGPT)',
      url: 'https://chatgpt.com',
      hosts: ['chatgpt.com', 'chat.openai.com'],
      chatPaths: ['/c/', '/g/', '/share/', '/s/cx_'],
      inputSelectors: [
        '#prompt-textarea',
        'div[contenteditable="true"][id="prompt-textarea"]',
        'form textarea[ data-id]',
        'main [contenteditable="true"]',
        'main textarea'
      ],
      sendButtonSelectors: [
        'button[data-testid="send-button"]',
        'form button[type="submit"]'
      ],
      turnSelectors: [
        'article[data-testid^="conversation-turn-"]',
        '[data-message-author-role]',
        '[data-turn-key]'
      ],
      userSelectors: [
        '[data-message-author-role="user"]',
        'article[data-turn="user"]',
        '.user-message'
      ],
      assistantSelectors: [
        '[data-message-author-role="assistant"]',
        'article[data-turn="assistant"]',
        '.agent-turn'
      ],
      actionToolbarSelectors: [
        '[data-turn-key] .turn-action-controls',
        'article [data-testid*="copy-turn-action-button"]',
        '[data-turn="assistant"] [data-testid*="copy-turn-action-button"]'
      ]
    },
    {
      id: 'claude',
      name: 'Claude',
      nameFa: 'کلود (Claude)',
      url: 'https://claude.ai',
      hosts: ['claude.ai'],
      chatPaths: ['/chat', '/cowork/', '/share/', '/c/', '/new'],
      inputSelectors: [
        'div.ProseMirror[contenteditable="true"]',
        'fieldset [contenteditable="true"]',
        '[data-testid="chat-input"] [contenteditable="true"]',
        '[contenteditable="true"]'
      ],
      sendButtonSelectors: [
        'button[aria-label*="Send"]',
        'fieldset button[type="button"]:last-of-type'
      ],
      turnSelectors: [
        '[data-testid="user-message"]',
        '.font-claude-message',
        '.font-claude-response',
        '[data-test-render-count]'
      ],
      userSelectors: [
        '[data-testid="user-message"]',
        '.font-user-message'
      ],
      assistantSelectors: [
        '.font-claude-message',
        '.font-claude-response',
        '[data-is-streaming]'
      ],
      actionToolbarSelectors: [
        '[data-cds="MessageActions"]'
      ]
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      nameFa: 'گوگل جمینای (Gemini)',
      url: 'https://gemini.google.com',
      hosts: ['gemini.google.com'],
      chatPaths: ['/app', '/gem/', '/share/'],
      inputSelectors: [
        'rich-textarea .ql-editor[contenteditable="true"]',
        'div.ql-editor[contenteditable="true"]',
        '[aria-label*="prompt" i][contenteditable="true"]',
        '[role="textbox"][contenteditable="true"]'
      ],
      sendButtonSelectors: [
        'button.send-button',
        'button[aria-label*="Send" i]'
      ],
      turnSelectors: [
        'user-query',
        'model-response',
        '.conversation-container'
      ],
      userSelectors: [
        'user-query',
        '.user-query-container',
        '.query-text'
      ],
      assistantSelectors: [
        'model-response',
        '.model-response-text',
        'message-content'
      ],
      actionToolbarSelectors: [
        'message-actions div[class*="buttons-container"]'
      ]
    },
    {
      id: 'grok',
      name: 'Grok',
      nameFa: 'گروک (Grok)',
      url: 'https://grok.com',
      hosts: ['grok.com'],
      chatPaths: ['/chat', '/c/', '/share/'],
      inputSelectors: [
        'textarea[aria-label]',
        'form textarea',
        'div[contenteditable="true"]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button[type="submit"]',
        'button[aria-label*="Send" i]'
      ],
      turnSelectors: [
        '[id^="response"]',
        '[data-testid="user-message"]',
        '[data-testid="assistant-message"]',
        '.message-bubble'
      ],
      userSelectors: [
        '[data-testid="user-message"]',
        '.items-end .message-bubble'
      ],
      assistantSelectors: [
        '[data-testid="assistant-message"]',
        '[id^="response"] .markdown'
      ],
      actionToolbarSelectors: [
        '[id^="response"] .action-buttons'
      ]
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      nameFa: 'دیپ‌سیک (DeepSeek)',
      url: 'https://chat.deepseek.com',
      hosts: ['chat.deepseek.com'],
      chatPaths: ['/a/chat', '/'],
      inputSelectors: [
        'textarea#chat-input',
        'textarea[placeholder]',
        'textarea'
      ],
      sendButtonSelectors: [
        'div[role="button"][aria-disabled]',
        'button[type="submit"]'
      ],
      turnSelectors: [
        '.ds-markdown',
        '[class*="message"]',
        '.fbb737a4'
      ],
      userSelectors: [
        '.fbb737a4',
        '[class*="user-message"]'
      ],
      assistantSelectors: [
        '.ds-markdown',
        '[class*="assistant-message"]'
      ],
      actionToolbarSelectors: [
        '._965abe9',
        '.ds-flex [class*="icon"]'
      ]
    },
    {
      id: 'perplexity',
      name: 'Perplexity',
      nameFa: 'پرپلکسیتی (Perplexity)',
      url: 'https://www.perplexity.ai',
      hosts: ['www.perplexity.ai', 'perplexity.ai'],
      chatPaths: ['/search', '/computer/tasks', '/page/', '/'],
      inputSelectors: [
        'textarea[placeholder]',
        'div[contenteditable="true"][ id="ask-input"]',
        'div[contenteditable="true"]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button[aria-label*="Submit" i]',
        'button[aria-label*="Send" i]'
      ],
      turnSelectors: [
        '.prose',
        '[class*="Message"]'
      ],
      userSelectors: [
        'h1.group',
        '[data-testid="query-title"]',
        '.whitespace-pre-line.break-words'
      ],
      assistantSelectors: [
        '.prose',
        '[dir="auto"].prose'
      ],
      actionToolbarSelectors: [
        'div.flex.items-center.gap-x-xs'
      ]
    },
    {
      id: 'qwen',
      name: 'Qwen Chat',
      nameFa: 'کوئن علی‌بابا (Qwen)',
      url: 'https://chat.qwen.ai',
      hosts: ['chat.qwen.ai', 'www.qianwen.com', 'tongyi.aliyun.com'],
      chatPaths: ['/c/', '/chat/', '/'],
      inputSelectors: [
        'textarea#chat-input',
        'textarea[placeholder]',
        'div[contenteditable="true"]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button.send-button',
        'button[type="submit"]'
      ],
      turnSelectors: [
        '.qwen-chat-message',
        '.user-message',
        '.response-message-body'
      ],
      userSelectors: [
        '.user-message-content',
        '.chat-user-message'
      ],
      assistantSelectors: [
        '.response-message-body',
        '.markdown-body'
      ],
      actionToolbarSelectors: [
        '.response-message-footer .qwen-chat-package-comp-new-action-control-icons'
      ]
    },
    {
      id: 'kimi',
      name: 'Kimi AI',
      nameFa: 'کیمی (Kimi)',
      url: 'https://www.kimi.com',
      hosts: ['kimi.com', 'www.kimi.com', 'kimi.ai', 'www.kimi.ai', 'kimi.moonshot.cn'],
      chatPaths: ['/chat', '/'],
      inputSelectors: [
        'div.chat-input-editor[contenteditable="true"]',
        '[contenteditable="true"]',
        'textarea'
      ],
      sendButtonSelectors: [
        '.send-button',
        'button[type="submit"]'
      ],
      turnSelectors: [
        '.chat-content-item',
        '.segment-user',
        '.segment-assistant'
      ],
      userSelectors: [
        '.segment-user',
        '.user-content'
      ],
      assistantSelectors: [
        '.segment-assistant',
        '.markdown-container'
      ],
      actionToolbarSelectors: [
        '.segment-assistant-actions-content'
      ]
    },
    {
      id: 'copilot',
      name: 'Microsoft Copilot',
      nameFa: 'کوپایلت مایکروسافت (Copilot)',
      url: 'https://copilot.microsoft.com',
      hosts: ['copilot.microsoft.com', 'copilot.com'],
      chatPaths: ['/chats', '/chat/conversation', '/'],
      inputSelectors: [
        'textarea#userInput',
        'textarea[placeholder]',
        'div[contenteditable="true"]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button[data-testid="submit-button"]',
        'button[aria-label*="Submit" i]'
      ],
      turnSelectors: [
        '[data-content="user-message"]',
        '[data-content="ai-message"]',
        '[id*="chatMessageResponse-"]'
      ],
      userSelectors: [
        '[data-content="user-message"]'
      ],
      assistantSelectors: [
        '[data-content="ai-message"]',
        '[id*="chatMessageResponse-"]'
      ],
      actionToolbarSelectors: [
        '[id*="chatMessageResponse-"] button[data-testid="CopyButtonTestId"]'
      ]
    },
    {
      id: 'm365copilot',
      name: 'M365 Copilot',
      nameFa: 'کوپایلت سازمانی (M365)',
      url: 'https://m365.cloud.microsoft/chat',
      hosts: ['m365.cloud.microsoft'],
      chatPaths: ['/chat'],
      inputSelectors: [
        'div[contenteditable="true"]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button[type="submit"]'
      ],
      turnSelectors: [
        '[id*="chatMessageResponse-"]'
      ],
      userSelectors: [
        '[data-testid="user-message"]'
      ],
      assistantSelectors: [
        '[id*="chatMessageResponse-"]'
      ],
      actionToolbarSelectors: [
        '[id*="chatMessageResponse-"] button[data-testid="CopyButtonTestId"]'
      ]
    },
    {
      id: 'githubcopilot',
      name: 'GitHub Copilot',
      nameFa: 'کوپایلت گیت‌هاب (GitHub)',
      url: 'https://github.com/copilot',
      hosts: ['github.com'],
      chatPaths: ['/copilot'],
      inputSelectors: [
        'textarea#copilot-chat-textarea',
        'react-app[app-name*="copilot"] textarea'
      ],
      sendButtonSelectors: [
        'react-app[app-name*="copilot"] button[type="submit"]'
      ],
      turnSelectors: [
        '[class*="ChatMessage-module"]'
      ],
      userSelectors: [
        '[class*="ChatMessage-module__user"]'
      ],
      assistantSelectors: [
        '[class*="ChatMessage-module__assistant"]',
        '.markdown-body'
      ],
      actionToolbarSelectors: [
        '[class*="ChatMessage-module__actions"][data-testid="nonshared-toolbar"]'
      ]
    },
    {
      id: 'poe',
      name: 'Poe',
      nameFa: 'پو (Poe)',
      url: 'https://poe.com',
      hosts: ['poe.com'],
      chatPaths: ['/chat/', '/'],
      inputSelectors: [
        'textarea[class*="GrowingTextArea"]',
        'textarea[placeholder]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button[data-button-send="true"]'
      ],
      turnSelectors: [
        '[class*="ChatMessage_chatMessage"]',
        '[class*="Message_row"]'
      ],
      userSelectors: [
        '[class*="Message_humanMessageBubble"]'
      ],
      assistantSelectors: [
        '[class*="Message_botMessageBubble"]'
      ],
      actionToolbarSelectors: [
        '[class*="ChatMessageActionBar"]'
      ]
    },
    {
      id: 'googleaistudio',
      name: 'Google AI Studio',
      nameFa: 'گوگل ای‌آی استودیو (AI Studio)',
      url: 'https://aistudio.google.com',
      hosts: ['aistudio.google.com'],
      chatPaths: ['/prompts', '/app', '/'],
      inputSelectors: [
        'ms-autosize-textarea textarea',
        'textarea[aria-label*="Type something" i]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button.run-button',
        'button[type="submit"]'
      ],
      turnSelectors: [
        'ms-chat-turn',
        '[data-turn-role]'
      ],
      userSelectors: [
        '[data-turn-role="User"]',
        'ms-chat-turn .user-chunk'
      ],
      assistantSelectors: [
        '[data-turn-role="Model"]',
        'ms-chat-turn .model-chunk'
      ],
      actionToolbarSelectors: [
        '[data-turn-role="Model"]'
      ]
    },
    {
      id: 'notebooklm',
      name: 'NotebookLM',
      nameFa: 'نوت‌بوک ال‌ام (NotebookLM)',
      url: 'https://notebooklm.google.com',
      hosts: ['notebooklm.google.com', 'notebook.google.com'],
      chatPaths: ['/notebook', '/'],
      inputSelectors: [
        'chat-panel textarea',
        'textarea'
      ],
      sendButtonSelectors: [
        'chat-panel button[type="submit"]'
      ],
      turnSelectors: [
        'chat-message',
        '.chat-message-pair'
      ],
      userSelectors: [
        '.from-user-container'
      ],
      assistantSelectors: [
        '.to-user-container'
      ],
      actionToolbarSelectors: [
        'chat-panel mat-card-actions chat-actions'
      ]
    },
    {
      id: 'xgrok',
      name: 'X Grok',
      nameFa: 'گروک ایکس (X-Grok)',
      url: 'https://x.com/i/grok',
      hosts: ['x.com'],
      chatPaths: ['/i/grok'],
      inputSelectors: [
        'textarea[placeholder*="Ask" i]',
        '[data-testid="grokInput"] textarea',
        'textarea'
      ],
      sendButtonSelectors: [
        '[data-testid="grokSendButton"]'
      ],
      turnSelectors: [
        '[data-testid="grokMessage"]'
      ],
      userSelectors: [
        '[data-testid="grokUserMessage"]'
      ],
      assistantSelectors: [
        '[data-testid="grokAssistantMessage"]'
      ],
      actionToolbarSelectors: []
    },
    {
      id: 'mistral',
      name: 'Mistral Le Chat',
      nameFa: 'میسترال (Mistral Le Chat)',
      url: 'https://chat.mistral.ai',
      hosts: ['chat.mistral.ai'],
      chatPaths: ['/chat', '/'],
      inputSelectors: [
        'textarea',
        '[contenteditable="true"]'
      ],
      sendButtonSelectors: [
        'button[type="submit"]'
      ],
      turnSelectors: [
        '[data-message-author-role]',
        '.prose'
      ],
      userSelectors: [
        '[data-message-author-role="user"]'
      ],
      assistantSelectors: [
        '[data-message-author-role="assistant"]',
        '.prose'
      ],
      actionToolbarSelectors: []
    },
    {
      id: 'huggingchat',
      name: 'HuggingChat',
      nameFa: 'هاگینگ‌چت (HuggingChat)',
      url: 'https://huggingface.co/chat',
      hosts: ['huggingface.co'],
      chatPaths: ['/chat'],
      inputSelectors: [
        'textarea[placeholder*="Ask" i]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button[type="submit"]'
      ],
      turnSelectors: [
        '[data-message-id]'
      ],
      userSelectors: [
        '[data-message-role="user"]'
      ],
      assistantSelectors: [
        '[data-message-role="assistant"]',
        '.prose'
      ],
      actionToolbarSelectors: []
    },
    {
      id: 'doubao',
      name: 'Doubao',
      nameFa: 'دوبائو (Doubao)',
      url: 'https://www.doubao.com',
      hosts: ['www.doubao.com'],
      chatPaths: ['/chat/'],
      inputSelectors: [
        'textarea[data-testid="chat_input_input"]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button[data-testid="chat_input_send_button"]'
      ],
      turnSelectors: [
        '[data-foundation-type]'
      ],
      userSelectors: [
        '[data-testid="send_message"]'
      ],
      assistantSelectors: [
        '[data-testid="receive_message"]'
      ],
      actionToolbarSelectors: [
        '[data-foundation-type="receive-message-action-bar"] .message-action-button-main'
      ]
    },
    {
      id: 'yuanbao',
      name: 'Tencent Yuanbao',
      nameFa: 'یوان‌بائو (Yuanbao)',
      url: 'https://yuanbao.tencent.com',
      hosts: ['yuanbao.tencent.com'],
      chatPaths: ['/chat'],
      inputSelectors: [
        'div.ql-editor[contenteditable="true"]',
        'textarea'
      ],
      sendButtonSelectors: [
        '.send-btn'
      ],
      turnSelectors: [
        '.agent-chat__list__item'
      ],
      userSelectors: [
        '.agent-chat__list__item--human'
      ],
      assistantSelectors: [
        '.agent-chat__list__item--ai'
      ],
      actionToolbarSelectors: []
    },
    {
      id: 'googlesearch',
      name: 'Google Search AI Mode',
      nameFa: 'جستجوی هوشمند گوگل (AI Mode)',
      url: 'https://www.google.com/search?udm=50',
      hosts: ['www.google.com', 'www.google.co.uk', 'www.google.com.hk'],
      chatPaths: ['/search'],
      inputSelectors: [
        'textarea[name="q"]',
        'input[name="q"]'
      ],
      sendButtonSelectors: [
        'button[type="submit"]'
      ],
      turnSelectors: [
        '[data-subtree="aimc"]',
        '.CKgc1d'
      ],
      userSelectors: [
        'span[jsname="y5v2y"]',
        '.iMqumd'
      ],
      assistantSelectors: [
        '[data-subtree="aimc"]'
      ],
      actionToolbarSelectors: [
        '[id*="shrproxy"]'
      ]
    }
  ];

  function matchesHost(hostname, pattern) {
    return hostname === pattern || hostname.endsWith('.' + pattern);
  }

  function detectPlatform(urlStr) {
    try {
      const url = new URL(urlStr || global.location?.href || '');
      const host = url.hostname.toLowerCase();
      for (const platform of PLATFORMS) {
        if (platform.hosts.some((h) => matchesHost(host, h))) {
          if (platform.id === 'githubcopilot' && !url.pathname.startsWith('/copilot')) {
            continue;
          }
          if (platform.id === 'xgrok' && !url.pathname.startsWith('/i/grok')) {
            continue;
          }
          if (platform.id === 'huggingchat' && !url.pathname.startsWith('/chat')) {
            continue;
          }
          if (platform.id === 'googlesearch') {
            const isAiSearch = url.searchParams.has('mtid') || url.searchParams.get('udm') === '50';
            if (!isAiSearch) continue;
          }
          return platform;
        }
      }
    } catch (e) {}
    return null;
  }

  AMTool.PLATFORMS = PLATFORMS;
  AMTool.detectPlatform = detectPlatform;
})(typeof globalThis !== 'undefined' ? globalThis : self);
