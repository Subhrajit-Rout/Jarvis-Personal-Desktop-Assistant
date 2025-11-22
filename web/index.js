const conversationArea = document.getElementById('conversation-area');
        const micButton = document.getElementById('mic-button');
        const micIcon = document.getElementById('mic-icon');
        const micText = document.getElementById('mic-text');
        const initialPromptDiv = document.querySelector('.initial-prompt');
        let typingIndicatorElement = null;

        let isListening = false;
        let isProcessing = false;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        let recognition;

        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'en-US';
            recognition.interimResults = false;

            recognition.onstart = () => {
                isListening = true;
                isProcessing = false; // Reset processing flag
                micButton.classList.add('listening');
                micIcon.classList.remove('fa-microphone', 'fa-spinner', 'fa-spin');
                micIcon.classList.add('fa-stop-circle');
                micText.textContent = 'Listening...';
                if (initialPromptDiv) initialPromptDiv.style.display = 'none';
            };

            recognition.onresult = async (event) => {
                stopListeningUI(); // Stop listening UI state immediately
                isProcessing = true; // Set processing state
                const userQuery = event.results[0][0].transcript;
                addMessageToUI(userQuery, true);
                
                showTypingIndicator();
                updateMicButtonState('processing');

                try {
                    const result = await eel.process_user_query(userQuery)();
                    removeTypingIndicator();

                    if (result && result.response) {
                        const aiResponseText = result.response;
                        addMessageToUI(aiResponseText, false);

                        if (result.should_speak === true) {
                             // Check for common error phrases before speaking
                            const errorPhrases = ["error", "apologize", "couldn't formulate", "issue processing", "neural network connection interrupted"];
                            const shouldSkipSpeak = errorPhrases.some(phrase => aiResponseText.toLowerCase().includes(phrase));
                            
                            if (!shouldSkipSpeak) {
                                eel.request_tts(aiResponseText)();
                            } else {
                                console.log("Skipping TTS for error/apology message:", aiResponseText);
                            }
                        }
                    } else {
                        addMessageToUI("Jarvis returned an unexpected response.", false);
                    }
                } catch (error) {
                    console.error("Error calling Python via Eel:", error);
                    removeTypingIndicator();
                    addMessageToUI('Neural network connection interrupted. Please try again.', false);
                } finally {
                    isProcessing = false;
                    updateMicButtonState('idle');
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                let errorMessage = 'Speech input error. Try again.';
                if (event.error === 'no-speech') errorMessage = 'No speech detected.';
                else if (event.error === 'audio-capture') errorMessage = 'Microphone error.';
                else if (event.error === 'not-allowed') errorMessage = 'Microphone access denied.';
                
                removeTypingIndicator(); // Ensure typing indicator is removed on error
                addMessageToUI(errorMessage, false);
                isProcessing = false; // Reset processing flag
                stopListeningUI(); // Also reset listening state
                updateMicButtonState('idle');
            };

            recognition.onend = () => {
                // This onend can be triggered by recognition.stop() or naturally.
                // If it's not already processing a result, reset the UI.
                if (!isProcessing) {
                    stopListeningUI();
                    updateMicButtonState('idle');
                }
            };

            micButton.addEventListener('click', () => {
                if (isProcessing) return;

                if (!isListening) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error("Error starting recognition:", e);
                        addMessageToUI("Could not start listening. Mic issue?", false);
                        updateMicButtonState('idle');
                    }
                } else {
                    recognition.stop(); // This will trigger onend
                }
            });

        } else {
            // Fallback for browsers without SpeechRecognition
            addMessageToUI("Your browser doesn't support speech recognition. Try Chrome or Edge.", false);
            if (initialPromptDiv) initialPromptDiv.style.display = 'none';
            micButton.disabled = true;
            micText.textContent = 'Not Supported';
            micIcon.classList.remove('fa-microphone');
            micIcon.classList.add('fa-times-circle');
        }

        function stopListeningUI() {
            isListening = false;
            micButton.classList.remove('listening');
        }
        
        function updateMicButtonState(state) {
            micButton.classList.remove('listening'); // General reset
            switch(state) {
                case 'listening':
                    isListening = true; isProcessing = false;
                    micButton.classList.add('listening');
                    micIcon.className = 'fas fa-stop-circle icon';
                    micText.textContent = 'Listening...';
                    break;
                case 'processing':
                    isListening = false; isProcessing = true;
                    micIcon.className = 'fas fa-spinner fa-spin icon';
                    micText.textContent = 'Jarvis Processing...';
                    break;
                case 'idle':
                default:
                    isListening = false; isProcessing = false;
                    micIcon.className = 'fas fa-microphone icon';
                    micText.textContent = 'Activate Jarvis';
                    break;
            }
        }


        function addMessageToUI(text, isUser = true, isTyping = false) {
            if (initialPromptDiv && initialPromptDiv.style.display !== 'none') {
                initialPromptDiv.style.display = 'none';
            }
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            if (isTyping) {
                messageElement.classList.add('ai-typing');
                messageElement.id = 'ai-typing-indicator';
                messageElement.innerHTML = `
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>`;
                typingIndicatorElement = messageElement;
            } else {
                messageElement.classList.add(isUser ? 'user-message' : 'ai-message');
                messageElement.textContent = text;
            }
            
            conversationArea.appendChild(messageElement);
            scrollToBottom();
        }

        function showTypingIndicator() {
            if (!typingIndicatorElement) { // Add only if not already present
                 addMessageToUI('', false, true);
            }
        }
        function removeTypingIndicator() {
            if (typingIndicatorElement) {
                typingIndicatorElement.remove();
                typingIndicatorElement = null;
            }
        }

        function scrollToBottom() {
            // A short delay helps ensure the element is fully rendered and height calculated
            setTimeout(() => {
                conversationArea.scrollTop = conversationArea.scrollHeight;
            }, 50);
        }

        // Initial state update
        updateMicButtonState('idle');