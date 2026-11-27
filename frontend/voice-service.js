export class VoiceService {
  constructor({ onTranscript, onStateChange, onError }) {
    this.onTranscript = onTranscript;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.recognition = null;
    this.state = "idle";
    this.language = "hi";
    this.englishFallback = false;

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (Recognition) {
      this.recognition = new Recognition();
      this.recognition.lang = "hi-IN";
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.onstart = () => this.setState(
        "listening",
        this.copy("सुन रहा हूँ…", "Listening…"),
      );
      this.recognition.onresult = (event) => {
        let interim = "";
        let finalText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalText += result[0].transcript;
          else interim += result[0].transcript;
        }
        if (interim) this.onTranscript(interim, false);
        if (finalText.trim()) this.onTranscript(finalText.trim(), true);
      };
      this.recognition.onerror = (event) => {
        if (event.error === "language-not-supported" && this.language === "hi" && !this.englishFallback) {
          this.englishFallback = true;
          this.recognition.lang = "en-IN";
          const message = this.copy(
            "हिंदी आवाज़ पहचान उपलब्ध नहीं है। अगली बार अंग्रेज़ी में बोलकर कोशिश करें।",
            "Hindi recognition is unavailable. Try speaking in English next time.",
          );
          this.setState("error", message);
          this.onError(message);
          return;
        }
        const messages = this.language === "en" ? {
          "not-allowed": "Microphone permission was denied. Allow it in browser settings or type your message.",
          "service-not-allowed": "The browser blocked speech recognition. Type your message instead.",
          "no-speech": "No speech was detected. Try again or type your message.",
          "audio-capture": "No microphone was found. Check your device or type your message.",
          network: "Speech recognition service is unavailable. Type your message instead.",
        } : {
          "not-allowed": "माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र सेटिंग्स में अनुमति दें या लिखकर संदेश भेजें।",
          "service-not-allowed": "ब्राउज़र ने आवाज़ पहचान सेवा की अनुमति नहीं दी। लिखकर संदेश भेजें।",
          "no-speech": "आवाज़ सुनाई नहीं दी। फिर से बोलें या लिखकर संदेश भेजें।",
          "audio-capture": "माइक्रोफ़ोन नहीं मिला। अपने डिवाइस की जाँच करें या लिखकर संदेश भेजें।",
          network: "आवाज़ पहचान सेवा उपलब्ध नहीं है। लिखकर संदेश भेजें।",
        };
        const fallback = this.copy(
          "आवाज़ पहचान में समस्या आई। लिखकर संदेश भेजें।",
          "Speech recognition failed. Type your message instead.",
        );
        this.setState("error", messages[event.error] ?? fallback);
        this.onError(messages[event.error] ?? fallback);
      };
      this.recognition.onend = () => {
        if (this.state === "listening") {
          this.setState("idle", this.copy("अब आप बोल सकते हैं।", "You can speak now."));
        }
      };
    }
  }

  copy(hindi, english) {
    return this.language === "en" ? english : hindi;
  }

  setLanguage(language) {
    const previousState = this.state;
    if (this.state === "listening") this.recognition.stop();
    this.language = language;
    this.englishFallback = false;
    if (this.recognition) this.recognition.lang = language === "en" ? "en-IN" : "hi-IN";
    if (previousState === "speaking") {
      this.setState("speaking", this.copy("जवाब बोल रहा हूँ…", "Speaking the response…"));
    } else if (previousState === "processing") {
      this.setState("processing", this.copy("आपकी बात समझ रहा हूँ…", "Processing your request…"));
    } else {
      this.setState("idle", this.copy("अब आप बोल सकते हैं।", "You can speak now."));
    }
  }

  setState(state, message) {
    this.state = state;
    this.onStateChange(state, message);
  }

  start() {
    if (!this.recognition) {
      const message = this.copy(
        "इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। लिखकर संदेश भेजें।",
        "Speech recognition is unavailable in this browser. Type your message instead.",
      );
      this.setState("error", message);
      this.onError(message);
      return;
    }
    if (this.state === "listening") {
      this.recognition.stop();
      return;
    }
    this.recognition.lang = this.language === "en" || this.englishFallback ? "en-IN" : "hi-IN";
    this.setState("idle", this.copy(
      "माइक्रोफ़ोन की अनुमति का इंतज़ार है…",
      "Waiting for microphone permission…",
    ));
    try {
      this.recognition.start();
    } catch (error) {
      this.setState("error", this.copy(
        "माइक्रोफ़ोन शुरू नहीं हो सका। लिखकर संदेश भेजें।",
        "Could not start the microphone. Type your message instead.",
      ));
      this.onError(this.copy(
        `आवाज़ शुरू नहीं हो सकी: ${error.message}`,
        `Could not start speech recognition: ${error.message}`,
      ));
    }
  }

  processing() {
    this.setState("processing", this.copy("आपकी बात समझ रहा हूँ…", "Processing your request…"));
  }

  speak(text) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      this.setState("idle", this.copy(
        "जवाब तैयार है। इस ब्राउज़र में आवाज़ नहीं चल सकती।",
        "Your response is ready, but speech output is unavailable in this browser.",
      ));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.language === "en" ? "en-IN" : "hi-IN";
    utterance.rate = 0.94;
    utterance.onstart = () => this.setState("speaking", this.copy("जवाब बोल रहा हूँ…", "Speaking the response…"));
    utterance.onend = () => this.setState("idle", this.copy("अब आप बोल सकते हैं।", "You can speak now."));
    utterance.onerror = (event) => {
      this.setState("error", this.copy(
        "लिखित जवाब उपलब्ध है, लेकिन आवाज़ नहीं चल सकी।",
        "The written response is available, but speech could not be played.",
      ));
      this.onError(this.copy(
        `आवाज़ नहीं चल सकी: ${event.error}`,
        `Speech synthesis error: ${event.error}`,
      ));
    };
    window.speechSynthesis.speak(utterance);
  }
}
