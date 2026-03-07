export function updateDailyQuestProgress(quest) {
  if (!quest.completed) {
    quest.progress += 1;

    if (quest.progress >= quest.target) {
      quest.completed = true;
      return quest.reward;
    }
  }

  return 0;
}