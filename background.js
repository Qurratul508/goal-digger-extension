// Listen for alarms and show notifications
chrome.alarms.onAlarm.addListener((alarm) => {
    const taskName = alarm.name;
  
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "GoalDigger Reminder",
      message: `Time to dig: ${taskName}`,
      priority: 2
    });
  });
  