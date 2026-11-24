let tasks = JSON.parse(localStorage.getItem('shs_tasks')) || [];
let currentFilter = 'all';
let deferredPrompt;

const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const filterBtns = document.querySelectorAll('.filter-btn');
const notifyBtn = document.getElementById('notifyBtn');
const installBtn = document.getElementById('installBtn');

// 1. Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('Service Worker Registered'))
    .catch(err => console.log('SW Error:', err));
}

// 2. Install App Prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
});

installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      installBtn.style.display = 'none';
    }
    deferredPrompt = null;
  }
});

// 3. Notification Permission Button (Updated with Troubleshooting Alerts)
notifyBtn.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    alert('Hindi supported ng browser na ito ang notifications. Subukang i-Add to Home Screen muna o gumamit ng Google Chrome.');
    return;
  }

  if (Notification.permission === 'denied') {
    alert('Naka-BLOCK ang notifications sa browser settings mo. I-tap ang lock/settings icon sa tabi ng website link sa taas at i-allow ang Notifications.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notifyBtn.textContent = '✅ Alerts Enabled';
      notifyBtn.style.background = '#10b981';
      notifyBtn.style.color = 'white';

      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('Academic Task Monitor', {
          body: 'Naka-on na ang deadline alerts! Lalabas na ito sa notification bar at lockscreen.',
          vibrate: [200, 100, 200]
        });
      }
    } else {
      alert('Hindi na-allow ang notification. Subukan ulit o i-check ang browser settings.');
    }
  } catch (error) {
    alert('Error sa pag-enable ng alert: ' + error.message);
  }
});

// 4. Add New Task
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const newTask = {
    id: Date.now(),
    title: document.getElementById('taskTitle').value,
    subject: document.getElementById('taskSubject').value,
    deadline: document.getElementById('taskDeadline').value,
    desc: document.getElementById('taskDesc').value,
    completed: false,
    notified: false
  };

  tasks.push(newTask);
  saveAndRender();
  taskForm.reset();
});

// 5. Save and Render Tasks
function saveAndRender() {
  localStorage.setItem('shs_tasks', JSON.stringify(tasks));
  renderTasks();
}

function renderTasks() {
  taskList.innerHTML = '';
  const now = new Date();

  tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const filteredTasks = tasks.filter(task => {
    const isOverdue = !task.completed && new Date(task.deadline) < now;
    if (currentFilter === 'completed') return task.completed;
    if (currentFilter === 'overdue') return isOverdue;
    if (currentFilter === 'upcoming') return !task.completed && !isOverdue;
    return true;
  });

  if (filteredTasks.length === 0) {
    taskList.innerHTML = '<p style="text-align:center; color:#64748b; padding:20px;">No academic tasks found in this category.</p>';
    return;
  }

  filteredTasks.forEach(task => {
    const deadlineDate = new Date(task.deadline);
    const isOverdue = !task.completed && deadlineDate < now;
    
    let statusClass = '';
    let statusLabel = '<span class="status-tag upcoming-text">• Upcoming</span>';

    if (task.completed) {
      statusClass = 'completed';
      statusLabel = '<span class="status-tag completed-text">• Completed</span>';
    } else if (isOverdue) {
      statusClass = 'overdue';
      statusLabel = '<span class="status-tag overdue-text">• OVERDUE</span>';
    }

    const formattedDate = deadlineDate.toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const card = document.createElement('div');
    card.className = `task-card ${statusClass}`;
    card.innerHTML = `
      <div class="task-info">
        <span class="badge">${task.subject}</span> ${statusLabel}
        <h3>${task.title}</h3>
        <p>${task.desc || 'No additional notes.'}</p>
        <div class="task-deadline">⏰ Due: ${formattedDate}</div>
      </div>
      <div class="task-actions">
        <button class="btn-done" onclick="toggleTask(${task.id})">
          ${task.completed ? 'Undo' : '✓ Done'}
        </button>
        <button class="btn-delete" onclick="deleteTask(${task.id})">Delete</button>
      </div>
    `;
    taskList.appendChild(card);
  });
}

window.toggleTask = function(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  saveAndRender();
};

window.deleteTask = function(id) {
  if (confirm('Delete this academic task?')) {
    tasks = tasks.filter(t => t.id !== id);
    saveAndRender();
  }
};

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// 6. Deadline Checker (Every 10 seconds)
setInterval(() => {
  const now = new Date();
  let updated = false;

  tasks.forEach(task => {
    const due = new Date(task.deadline);
    if (!task.completed && !task.notified && due <= now) {
      sendSystemNotification(task);
      task.notified = true;
      updated = true;
    }
  });

  if (updated) saveAndRender();
}, 10000);

function sendSystemNotification(task) {
  if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(`🚨 DEADLINE NA: ${task.subject}`, {
        body: `Task: ${task.title}\nTap to view your task monitor.`,
        vibrate:,
        tag: 'deadline-' + task.id
      });
    });
  }
}

renderTasks();
            
