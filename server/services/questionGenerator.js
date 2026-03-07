export async function generateQuestionsFromText(text) {
  const cleaned = text.replace(/\s+/g, " ").slice(0, 4000);

  // Replace this with your real LLM/API call.
  // For Milestone 3, this file is where AI generation should live.

  return [
    {
      question_text: `Based on the uploaded document, which topic is discussed most directly?`,
      option_a: "Topic A",
      option_b: "Topic B",
      option_c: "Topic C",
      option_d: "Topic D",
      correct_answer: "a",
    },
    {
      question_text: `What is one important concept found in the uploaded material?`,
      option_a: "Concept A",
      option_b: "Concept B",
      option_c: "Concept C",
      option_d: "Concept D",
      correct_answer: "b",
    },
    {
      question_text: `Which answer best matches the document content?`,
      option_a: "Choice A",
      option_b: "Choice B",
      option_c: "Choice C",
      option_d: "Choice D",
      correct_answer: "c",
    },
    {
      question_text: `What idea is reinforced by the uploaded document?`,
      option_a: "Idea A",
      option_b: "Idea B",
      option_c: "Idea C",
      option_d: "Idea D",
      correct_answer: "d",
    },
    {
      question_text: `Which statement is most consistent with the uploaded text?`,
      option_a: cleaned.slice(0, 40) || "Statement A",
      option_b: "Statement B",
      option_c: "Statement C",
      option_d: "Statement D",
      correct_answer: "a",
    },
  ];
}