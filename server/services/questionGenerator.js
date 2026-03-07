export async function generateQuestionsFromText(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const snippet = cleaned.slice(0, 300);

  return [
    {
      question_text: "What is the main subject of the uploaded document?",
      option_a: snippet.slice(0, 40) || "Topic from the beginning of the text",
      option_b: "An unrelated historical event",
      option_c: "A random mathematical formula",
      option_d: "A fictional story element",
      correct_answer: "a",
    },
    {
      question_text: "Which choice best reflects a concept found in the document?",
      option_a: "A completely unrelated concept",
      option_b: cleaned.slice(40, 80) || "A concept from the uploaded text",
      option_c: "A sports statistic",
      option_d: "A weather forecast",
      correct_answer: "b",
    },
    {
      question_text: "What kind of information does the document appear to emphasize?",
      option_a: "Irrelevant entertainment news",
      option_b: "Random shopping advice",
      option_c: cleaned.slice(80, 120) || "An idea discussed in the text",
      option_d: "Travel booking details",
      correct_answer: "c",
    },
    {
      question_text: "Which statement is most likely supported by the uploaded material?",
      option_a: "The text is about unrelated events",
      option_b: "The text contains no meaningful content",
      option_c: "The text is only numerical data",
      option_d: cleaned.slice(120, 170) || "A statement supported by the text",
      correct_answer: "d",
    },
    {
      question_text: "Which excerpt is most consistent with the uploaded document?",
      option_a: cleaned.slice(170, 220) || "An excerpt from the uploaded text",
      option_b: "An unrelated quote",
      option_c: "A made-up statement",
      option_d: "A sentence from a different topic",
      correct_answer: "a",
    },
  ];
}