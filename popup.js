let oauthToken = null;

// 🔐 Fetch and cache the OAuth token
function getAuthToken(callback) {
  if (oauthToken) {
    callback(oauthToken);
  } else {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        alert("Google Auth Error: " + chrome.runtime.lastError.message);
        return;
      }
      oauthToken = token;
      callback(token);
    });
  }
}

// ✅ Run only after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {

  // 💬 Motivational quotes
  const quotes = [
    "You don’t need more time, you just need to decide.",
    "Small progress is still progress.",
    "Do it for your future self.",
    "Consistency > Motivation.",
    "Every goal starts with a single dig.",
    "You are your only limit.",
    "Focus on the step in front of you, not the whole staircase.",
    "Done is better than perfect.",
    "Dream big. Dig daily.",
    "You’re doing better than you think 💜"
  ];
  
  function showRandomQuote() {
    const quoteEl = document.getElementById('quote');
    const randomIndex = Math.floor(Math.random() * quotes.length);
    quoteEl.textContent = quotes[randomIndex];
  }
  
  // 🧠 Helper: Delete an event from Google Calendar
  function deleteEventFromCalendar(eventId) {
    getAuthToken((token) => {
      fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + token
        }
      }).then(() => {
        console.log("🗑️ Event deleted from Google Calendar");
      }).catch(err => {
        console.error("❌ Failed to delete event:", err);
      });
    });
  }
  
document.getElementById('visit-site-btn').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.windows.create({
    url: "https://bit.ly/GoalDiggerExtension",
    type: "popup",
    width: 420,
    height: 560
  });
});


  // 🧠 Helper: Update an event in Google Calendar
  function updateEventInCalendar(eventId, updates) {
    getAuthToken((token) => {
      fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })
      .then(res => res.json())
      .then(data => {
        console.log("✏️ Event updated in Google Calendar:", data);
      })
      .catch(err => {
        console.error("❌ Failed to update event:", err);
      });
    });
  }
  
  const taskInput = document.getElementById('task');
  const dateInput = document.getElementById('date');
  const reminderInput = document.getElementById('reminder');
  const taskList = document.getElementById('task-list');
  const emptyMsg = document.getElementById('empty-msg');
  const submitButton = document.getElementById('submit');
  const googleButton = document.getElementById('google-auth');

  // 📅 Google Auth button
  googleButton.addEventListener('click', () => {
    getAuthToken((token) => {
      alert("Connected to Google Calendar! ✅");
      console.log("OAuth Token:", token);
    });
  });
  showRandomQuote();
  // 📋 Load and render tasks
  function loadTasks() {
    taskList.innerHTML = '';
    chrome.storage.local.get({ tasks: [] }, (result) => {
      const tasks = result.tasks;

      if (tasks.length === 0) {
        emptyMsg.textContent = "No goals yet. Start digging!";
        return;
      }

      emptyMsg.textContent = '';

      tasks.forEach((taskObj, index) => {
        const li = document.createElement('li');
        const taskText = `${taskObj.task} → ${new Date(taskObj.date).toLocaleString()}`;

        const textSpan = document.createElement('span');
        textSpan.textContent = taskText;
        if (taskObj.done) textSpan.style.textDecoration = 'line-through';

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'task-buttons';

        // ✅ Done
        const doneBtn = document.createElement('button');
        doneBtn.textContent = taskObj.done ? '🔁' : '✅';
        doneBtn.title = taskObj.done ? 'Mark as not done' : 'Mark as done';
        doneBtn.onclick = () => toggleDone(index);

        // ✏️ Edit
        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️';
        editBtn.title = 'Edit task';
        editBtn.onclick = () => editTask(index, taskObj);

        // 🗑️ Delete
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete task';
        deleteBtn.onclick = () => deleteTask(index);

        buttonsDiv.appendChild(doneBtn);
        buttonsDiv.appendChild(editBtn);
        buttonsDiv.appendChild(deleteBtn);

        li.appendChild(textSpan);
        li.appendChild(buttonsDiv);
        taskList.appendChild(li);
      });
    });
  }

  // ➕ Add new task
  submitButton.addEventListener('click', () => {
    const task = taskInput.value.trim();
    const date = dateInput.value;
    const reminderOffset = parseInt(reminderInput.value);

    if (!task || !date) {
      alert("Please enter both a task and a date!");
      return;
    }

    const taskObject = {
      task,
      date,
      reminderOffset,
      createdAt: new Date().toISOString(),
      done: false
    };

    chrome.storage.local.get({ tasks: [] }, (result) => {
      const updatedTasks = [...result.tasks, taskObject];

      chrome.storage.local.set({ tasks: updatedTasks }, () => {
        // Set alarm
        const taskTime = new Date(date).getTime();
        const alarmTime = taskTime - reminderOffset * 60000;
        const delayInMinutes = Math.max((alarmTime - Date.now()) / 60000, 0.1);
        chrome.alarms.create(task, { delayInMinutes });

        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "GoalDigger",
          message: `🪙 Task saved! Reminder set ${reminderOffset === 0 ? 'at' : reminderOffset + ' min before'} deadline.`,
          priority: 1
        });

        taskInput.value = '';
        dateInput.value = '';
        reminderInput.value = '0';
        loadTasks();

        // Try to sync to Google Calendar
        getAuthToken((token) => {
          const event = {
            summary: task,
            start: {
              dateTime: new Date(date).toISOString()
            },
            end: {
              dateTime: new Date(new Date(date).getTime() + 30 * 60 * 1000).toISOString()
            }
          };

          fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
          })
            .then(res => res.json())
            .then(data => {
                console.log("📅 Event created:", data);
                const eventId = data.id;
                
                // Update the last-added task in local storage with eventId
                chrome.storage.local.get({ tasks: [] }, (res) => {
                  const tasks = res.tasks;
                  tasks[tasks.length - 1].eventId = eventId; // Attach eventId
                  chrome.storage.local.set({ tasks });
                });
                
              chrome.notifications.create({
                type: "basic",
                iconUrl: "icons/icon128.png",
                title: "Google Calendar",
                message: `"${task}" was added to your calendar.`,
                priority: 1
              });
            })
            .catch(err => {
              console.error("❌ Calendar add failed:", err);
            });
        });
      });
    });
  });

  // ✅ Toggle task done/undone
  function toggleDone(index) {
    chrome.storage.local.get({ tasks: [] }, (result) => {
      const tasks = result.tasks;
      const wasDone = tasks[index].done;
      tasks[index].done = !tasks[index].done;

      if (!wasDone) {
        const audio = document.getElementById('doneSound');
        if (audio) audio.play();

        if (typeof confetti === 'function') {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      }

      chrome.storage.local.set({ tasks }, loadTasks);
    });
  }

  // 🗑️ Delete task
  function deleteTask(index) {
    chrome.storage.local.get({ tasks: [] }, (result) => {
      const tasks = result.tasks;
      const eventId = tasks[index].eventId;
      if (eventId) deleteEventFromCalendar(eventId);
      tasks.splice(index, 1);
      chrome.storage.local.set({ tasks }, loadTasks);
    });
  }  

  // ✏️ Edit task
  function editTask(index, taskObj) {
    const newTask = prompt("Edit task name:", taskObj.task);
    const newDate = prompt("Edit date/time (YYYY-MM-DDTHH:MM):", taskObj.date);
  
    if (newTask && newDate) {
      chrome.storage.local.get({ tasks: [] }, (result) => {
        const tasks = result.tasks;
        tasks[index].task = newTask;
        tasks[index].date = newDate;
        tasks[index].done = false;
  
        // 🧠 Update Google Calendar
        if (tasks[index].eventId) {
          updateEventInCalendar(tasks[index].eventId, {
            summary: newTask,
            start: { dateTime: new Date(newDate).toISOString() },
            end: { dateTime: new Date(new Date(newDate).getTime() + 30 * 60 * 1000).toISOString() }
          });
        }
  
        chrome.storage.local.set({ tasks }, loadTasks);
      });
    }
  }
  

  // 🔄 Initial load
  loadTasks();
});
