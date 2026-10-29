(() => {
  const seedTasks = [
    { id: 1, key: 'SMS-1', type: 'Task', title: 'Design login page', description: 'Create a clean login screen for students and administrators.', priority: 'High', status: 'To Do', assignee: 'Lisha' },
    { id: 2, key: 'SMS-2', type: 'Story', title: 'Develop student registration', description: 'Build the registration form with required field validation.', priority: 'Medium', status: 'In Progress', assignee: 'Arjun' },
    { id: 3, key: 'SMS-3', type: 'Task', title: 'Test login functionality', description: 'Check valid credentials, invalid credentials, and error messages.', priority: 'Medium', status: 'Done', assignee: 'Meera' },
    { id: 4, key: 'SMS-4', type: 'Bug', title: 'Fix login validation bug', description: 'Resolve the issue where empty fields are accepted.', priority: 'High', status: 'To Do', assignee: 'Lisha' },
    { id: 5, key: 'SMS-5', type: 'Task', title: 'Prepare project documentation', description: 'Document the system requirements and testing process.', priority: 'Low', status: 'To Do', assignee: 'Arjun' }
  ];
  const seedMembers = [
    { id: 1, name: 'Lisha', email: 'lisha@example.com' },
    { id: 2, name: 'Arjun', email: 'arjun@example.com' },
    { id: 3, name: 'Meera', email: 'meera@example.com' }
  ];
  const statuses = ['To Do', 'In Progress', 'Done'];
  const types = ['Task', 'Story', 'Bug'];
  const priorities = ['High', 'Medium', 'Low'];
  const storageKey = 'sms-jira-demo';
  const themeKey = 'sms-jira-theme';
  const $ = id => document.getElementById(id);
  let toastTimer;
  const state = loadState();
  let tasks = state.tasks;
  let members = state.members;
  let sprints = state.sprints;
  let currentEmail = state.currentEmail;
  let pulses = state.pulses;
  let ecoActions = state.ecoActions;
  let nextId = Math.max(5, ...tasks.map(task => task.id)) + 1;
  let nextMemberId = Math.max(0, ...members.map(member => member.id)) + 1;
  let nextSprintId = Math.max(0, ...sprints.map(sprint => sprint.id)) + 1;
  let expandedComments = new Set();
  let editingMemberId = null;
  let authMode = 'login';

  function showToast(message) {
    const element = $('toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2800);
  }

  function leafTasks() {
    return tasks.filter(task => !tasks.some(child => child.parentKey === task.key));
  }

  function isValidTask(task) {
    return task && Number.isInteger(task.id) && typeof task.key === 'string' &&
      types.includes(task.type) && typeof task.title === 'string' &&
      typeof task.description === 'string' && priorities.includes(task.priority) &&
      statuses.includes(task.status) && typeof task.assignee === 'string' &&
      (!task.dueDate || /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) &&
      (!task.sprintId || Number.isInteger(task.sprintId)) && Array.isArray(task.comments) &&
      Number.isFinite(task.estimatePoints) && task.estimatePoints > 0 &&
      typeof task.statusChangedAt === 'string' &&
      (!task.parentKey || typeof task.parentKey === 'string');
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === null) return {
        tasks: seedTasks.map(task => ({ ...task, dueDate: '', sprintId: null, comments: [], estimatePoints: 2, statusChangedAt: new Date().toISOString().slice(0, 10), parentKey: '' })),
        members: seedMembers.map(member => ({ ...member })),
        sprints: [],
        currentEmail: '',
        pulses: [],
        ecoActions: []
      };
      const parsed = JSON.parse(saved);
      const storedTasks = Array.isArray(parsed) ? parsed : parsed.tasks;
      if (!Array.isArray(storedTasks)) throw new Error('Invalid saved task list');
      const normalizedTasks = storedTasks.map(task => ({
        ...task,
        dueDate: typeof task.dueDate === 'string' ? task.dueDate : '',
        sprintId: Number.isInteger(task.sprintId) ? task.sprintId : null,
        estimatePoints: Number.isFinite(task.estimatePoints) && task.estimatePoints > 0 ? task.estimatePoints : 2,
        statusChangedAt: typeof task.statusChangedAt === 'string' ? task.statusChangedAt : new Date().toISOString().slice(0, 10),
        parentKey: typeof task.parentKey === 'string' ? task.parentKey : '',
        comments: Array.isArray(task.comments) ? task.comments.filter(comment =>
          comment && typeof comment.text === 'string' && typeof comment.author === 'string'
        ) : []
      }));
      if (!normalizedTasks.every(isValidTask)) throw new Error('Invalid saved issue');
      const storedMembers = Array.isArray(parsed) ? seedMembers : parsed.members;
      const storedSprints = Array.isArray(parsed) ? [] : parsed.sprints;
      const storedPulses = Array.isArray(parsed) ? [] : (parsed.pulses || []);
      const storedEcoActions = Array.isArray(parsed) ? [] : (parsed.ecoActions || []);
      const validMembers = Array.isArray(storedMembers) && storedMembers.every(member =>
        member && Number.isInteger(member.id) && typeof member.name === 'string' &&
        typeof member.email === 'string'
      );
      const validSprints = Array.isArray(storedSprints) && storedSprints.every(sprint =>
        sprint && Number.isInteger(sprint.id) && typeof sprint.name === 'string' &&
        typeof sprint.startDate === 'string' && typeof sprint.endDate === 'string' &&
        ['Planned', 'In Progress', 'Completed'].includes(sprint.status)
      );
      const validPulses = Array.isArray(storedPulses) && storedPulses.every(pulse =>
        pulse && Number.isInteger(pulse.memberId) && /^\d{4}-\d{2}-\d{2}$/.test(pulse.date) &&
        Number.isInteger(pulse.workload) && pulse.workload >= 1 && pulse.workload <= 5 &&
        Number.isInteger(pulse.stress) && pulse.stress >= 1 && pulse.stress <= 5 &&
        typeof pulse.note === 'string'
      );
      const allowedEcoActions = ['digital-planning', 'paperless-reviews', 'remote-collaboration', 'energy-aware'];
      const validEcoActions = Array.isArray(storedEcoActions) &&
        storedEcoActions.every(action => allowedEcoActions.includes(action)) &&
        new Set(storedEcoActions).size === storedEcoActions.length;
      if (!validMembers || !validSprints || !validPulses || !validEcoActions) throw new Error('Invalid saved project data');
      return {
        tasks: normalizedTasks,
        members: storedMembers,
        sprints: storedSprints,
        currentEmail: typeof parsed.currentEmail === 'string' ? parsed.currentEmail : '',
        pulses: storedPulses,
        ecoActions: storedEcoActions
      };
    } catch (error) {
      showToast('Saved data could not be read. The example project has been loaded.');
      return {
        tasks: seedTasks.map(task => ({ ...task, dueDate: '', sprintId: null, comments: [], estimatePoints: 2, statusChangedAt: new Date().toISOString().slice(0, 10), parentKey: '' })),
        members: seedMembers.map(member => ({ ...member })),
        sprints: [],
        currentEmail: '',
        pulses: [],
        ecoActions: []
      };
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ tasks, members, sprints, currentEmail, pulses, ecoActions }));
      return true;
    } catch (error) {
      showToast('Could not save changes in this browser. Your latest changes may not persist.');
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function initials(value) {
    return (value || 'Unassigned').trim().split(/\s+/).slice(0, 2)
      .map(part => part[0] || '').join('').toUpperCase();
  }

  function getCurrentMember() {
    return members.find(member => member.email.toLowerCase() === currentEmail.toLowerCase()) || null;
  }

  function countsByStatus(items = tasks) {
    return Object.fromEntries(statuses.map(status => [
      status, items.filter(task => task.status === status).length
    ]));
  }

  function displayDate(value) {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function isOverdue(task) {
    if (!task.dueDate || task.status === 'Done') return false;
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return task.dueDate < localDate;
  }

  function daysBetween(start, end = new Date()) {
    const from = Date.parse(`${start}T00:00:00Z`);
    const to = Date.parse(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}T00:00:00Z`);
    return Number.isFinite(from) ? Math.max(0, Math.floor((to - from) / 86400000)) : 0;
  }

  function daysUntil(date, from = new Date()) {
    const now = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
    return Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${now}T00:00:00Z`)) / 86400000);
  }

  function taskRisk(task) {
    if (task.status === 'Done') return null;
    let score = 0;
    const reasons = [];
    if (!task.dueDate) {
      score += 10;
      reasons.push('No due date is set');
    } else {
      const daysLeft = daysUntil(task.dueDate);
      if (isOverdue(task)) {
        score += 50;
        reasons.push('Due date has passed');
      } else if (daysLeft <= 2) {
        score += 35;
        reasons.push(`Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`);
      } else if (daysLeft <= 7) {
        score += 20;
        reasons.push('Due within a week');
      }
    }
    if (task.assignee === 'Unassigned') {
      score += 20;
      reasons.push('No assignee');
    }
    const stuckDays = daysBetween(task.statusChangedAt);
    if (task.status === 'In Progress' && stuckDays >= 5) {
      score += 25;
      reasons.push(`In progress for ${stuckDays} days`);
    } else if (task.status === 'In Progress' && stuckDays >= 3) {
      score += 15;
      reasons.push(`In progress for ${stuckDays} days`);
    }
    if (task.type === 'Bug' && task.priority === 'High') {
      score += 10;
      reasons.push('High-priority bug');
    }
    const level = score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low';
    return { score: Math.min(score, 100), level, reasons };
  }

  function blockerReasons(task) {
    const reasons = [];
    if (task.status === 'In Progress') {
      const days = daysBetween(task.statusChangedAt);
      if (days >= 3) reasons.push(`No status change for ${days} days — check progress, blockers, and whether the work should be split`);
    }
    const blockerMention = `${task.title} ${task.description}`.match(/\b(blocked|blocker|waiting on|stuck|dependency)\b/i);
    if (blockerMention) reasons.push(`Text mentions "${blockerMention[0]}" — confirm the dependency owner and next action`);
    if (task.status === 'In Progress' && task.assignee === 'Unassigned') reasons.push('No owner is assigned — choose who will take the next step');
    return reasons;
  }

  function renderOverview(counts) {
    $('workflowSnapshot').innerHTML = statuses.map(status => {
      const count = counts[status];
      const width = tasks.length ? Math.round(count / tasks.length * 100) : 0;
      const className = status === 'To Do' ? 'todo' : status === 'Done' ? 'done' : 'progress';
      return `<div class="workflow-row"><div><span class="workflow-dot ${className}"></span><span>${escapeHtml(status)}</span><b>${count}</b></div><div class="workflow-track"><i class="${className}" style="width:${width}%"></i></div></div>`;
    }).join('');
    const recent = [...tasks].sort((a, b) => b.id - a.id).slice(0, 4);
    $('recentIssues').innerHTML = recent.length ? recent.map(task => `
      <div class="recent-row"><span class="recent-type ${escapeHtml(task.type.toLowerCase())}">${escapeHtml(task.type.slice(0, 1))}</span>
        <div class="recent-copy"><b>${escapeHtml(task.title)}</b><small>${escapeHtml(task.key)} · ${escapeHtml(task.status)}</small></div>
        <span class="avatar" title="${escapeHtml(task.assignee)}">${escapeHtml(initials(task.assignee))}</span></div>`).join('')
      : '<p class="empty">No issues yet. Create one to get started.</p>';
  }

  function renderBoard() {
    const query = $('search').value.trim().toLowerCase();
    const priority = $('filter').value;
    const type = $('filterType').value;
    const filtered = tasks.filter(task =>
      (priority === 'all' || task.priority === priority) &&
      (type === 'all' || task.type === type) &&
      [task.key, task.title, task.description, task.assignee, task.type]
        .join(' ').toLowerCase().includes(query)
    );
    $('resultsLabel').textContent = `Showing ${filtered.length} of ${tasks.length} issues`;
    $('columns').innerHTML = statuses.map(status => {
      const items = filtered.filter(task => task.status === status);
      const className = status === 'To Do' ? 'todo' : status === 'Done' ? 'done' : 'progress';
      const cards = items.map(task => {
        const sprint = sprints.find(item => item.id === task.sprintId);
        const commentsOpen = expandedComments.has(task.id);
        const member = members.find(item => item.name === task.assignee);
        return `<article class="issue">
          <div class="issuetop"><span class="type">${escapeHtml(task.type.toUpperCase())}</span><span class="key">${escapeHtml(task.key)}</span></div>
          <h3>${escapeHtml(task.title)}</h3>
          ${task.parentKey ? `<p class="sprint-tag">↳ Subtask of ${escapeHtml(task.parentKey)}</p>` : ''}
          ${task.description ? `<p class="desc">${escapeHtml(task.description)}</p>` : ''}
          <div class="issuebottom">
            <span class="priority ${escapeHtml(task.priority.toLowerCase())}">${escapeHtml(task.priority)} priority</span>
            <span class="assignee" title="${escapeHtml(task.assignee)}"><span class="avatar">${escapeHtml(initials(task.assignee))}</span>${escapeHtml(task.assignee)}</span>
          </div>
          ${task.dueDate ? `<p class="due-date ${isOverdue(task) ? 'overdue' : ''}">${isOverdue(task) ? '⚠ Overdue · ' : 'Due · '}${escapeHtml(displayDate(task.dueDate))}</p>` : ''}
          ${sprint ? `<p class="sprint-tag">◷ ${escapeHtml(sprint.name)}</p>` : ''}
          <p class="estimate-tag">${task.estimatePoints} story point${task.estimatePoints === 1 ? '' : 's'}</p>
          <select data-status="${task.id}" aria-label="Change status for ${escapeHtml(task.key)}">${statuses.map(option => `<option ${option === task.status ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>
          <div class="issue-actions"><button type="button" data-comments="${task.id}" aria-expanded="${commentsOpen}">Comments (${task.comments.length})</button><button type="button" data-split="${task.id}">Split</button>${member ? `<button type="button" data-email="${task.id}">Email assignee</button>` : ''}<button type="button" data-edit="${task.id}" aria-label="Edit ${escapeHtml(task.key)}">Edit</button><button type="button" data-delete="${task.id}" aria-label="Delete ${escapeHtml(task.key)}">Delete</button></div>
          ${commentsOpen ? `<section class="comments-panel" aria-label="Comments for ${escapeHtml(task.key)}">
            ${task.comments.length ? task.comments.map(comment => `<p class="comment"><b>${escapeHtml(comment.author)}</b><small>${escapeHtml(comment.date || '')}</small><span>${escapeHtml(comment.text)}</span></p>`).join('') : '<p class="comment-empty">No comments yet.</p>'}
            <form data-comment-form="${task.id}" class="comment-form"><input name="comment" required maxlength="500" aria-label="Add a comment" placeholder="Write a comment..."><button class="primary">Post</button></form>
          </section>` : ''}
        </article>`;
      }).join('');
      const emptyMessage = tasks.some(task => task.status === status)
        ? 'No issues match these filters.' : 'No issues here yet.';
      return `<section class="column" aria-label="${escapeHtml(status)} issues">
        <div class="colhead"><span><i class="status-dot ${className}"></i>${escapeHtml(status)} <span class="count">${items.length}</span></span><button type="button" data-add="${escapeHtml(status)}" aria-label="Add issue to ${escapeHtml(status)}">＋</button></div>
        ${cards || `<div class="empty">${emptyMessage}<button type="button" data-add="${escapeHtml(status)}">＋ Add an issue</button></div>`}
      </section>`;
    }).join('');
  }

  function renderTeam() {
    $('teamList').innerHTML = members.length ? members.map(member => {
      const assigned = leafTasks().filter(task => task.assignee === member.name).length;
      return `<article class="member-card"><span class="member-avatar">${escapeHtml(initials(member.name))}</span><div class="member-copy"><h2>${escapeHtml(member.name)}${member.email.toLowerCase() === currentEmail.toLowerCase() ? ' <small>(you)</small>' : ''}</h2><p>${escapeHtml(member.email)}</p><small>${assigned} assigned ${assigned === 1 ? 'issue' : 'issues'}</small></div><div class="member-actions"><button class="secondary" data-member-edit="${member.id}">Edit</button><button class="secondary" data-member-delete="${member.id}">Remove</button></div></article>`;
    }).join('') : '<p class="empty">No team members yet.</p>';
  }

  function renderSprints() {
    $('sprintList').innerHTML = sprints.length ? [...sprints].sort((a, b) => b.id - a.id).map(sprint => {
      const sprintTasks = tasks.filter(task => task.sprintId === sprint.id);
      const completed = sprintTasks.filter(task => task.status === 'Done').length;
      const percent = sprintTasks.length ? Math.round(completed / sprintTasks.length * 100) : 0;
      const nextState = sprint.status === 'Planned' ? 'In Progress' : sprint.status === 'In Progress' ? 'Completed' : '';
      return `<article class="overview-panel sprint-card">
        <div class="panel-heading"><div><h2>${escapeHtml(sprint.name)}</h2><p class="muted">${escapeHtml(displayDate(sprint.startDate))} – ${escapeHtml(displayDate(sprint.endDate))}</p></div><span class="sprint-status ${sprint.status.toLowerCase().replace(' ', '-')}">${escapeHtml(sprint.status)}</span></div>
        ${sprint.goal ? `<p class="sprint-goal">${escapeHtml(sprint.goal)}</p>` : ''}
        <div class="sprint-progress-label"><span>${completed} of ${sprintTasks.length} issues complete</span><b>${percent}%</b></div><div class="bar"><i style="width:${percent}%"></i></div>
        <div class="sprint-issues">${sprintTasks.length ? sprintTasks.map(task => `<div><span>${escapeHtml(task.key)} · ${escapeHtml(task.title)}</span><span class="sprint-issue-status">${escapeHtml(task.status)}</span></div>`).join('') : '<p class="empty">No issues assigned. Edit an issue to add it to this sprint.</p>'}</div>
        <div class="sprint-actions">${nextState ? `<button class="secondary" data-sprint-state="${sprint.id}">${sprint.status === 'Planned' ? 'Start sprint' : 'Complete sprint'}</button>` : ''}<button class="secondary" data-sprint-delete="${sprint.id}">Delete sprint</button></div>
      </article>`;
    }).join('') : '<div class="overview-panel empty">No sprints planned yet. Create a sprint to start planning project work.</div>';
  }

  function renderBars(containerId, rows) {
    const maximum = Math.max(1, ...rows.map(row => row.count));
    $(containerId).innerHTML = rows.length ? rows.map(row =>
      `<div class="report-row"><div><span>${escapeHtml(row.label)}</span><b>${row.count}</b></div><div class="report-track"><i class="${escapeHtml(row.className || '')}" style="width:${Math.round(row.count / maximum * 100)}%"></i></div></div>`
    ).join('') : '<p class="empty">No data to report yet.</p>';
  }

  function renderReports(counts) {
    const completed = counts.Done;
    const completion = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
    $('reportCompletion').textContent = `${completion}%`;
    $('reportOverdue').textContent = tasks.filter(isOverdue).length;
    $('reportSprints').textContent = sprints.filter(sprint => sprint.status === 'In Progress').length;
    $('reportMembers').textContent = members.length;
    renderBars('statusChart', statuses.map(status => ({
      label: status, count: counts[status],
      className: status === 'Done' ? 'done' : status === 'In Progress' ? 'progress' : 'todo'
    })));
    renderBars('priorityChart', priorities.map(priority => ({
      label: priority, count: tasks.filter(task => task.priority === priority).length,
      className: priority.toLowerCase()
    })));
    const workloadTasks = leafTasks();
    renderBars('workloadChart', members.map(member => ({
      label: member.name, count: workloadTasks.filter(task => task.assignee === member.name).length
    })).concat([{
      label: 'Unassigned', count: workloadTasks.filter(task => task.assignee === 'Unassigned').length
    }]));
  }

  function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function renderRisksAndBlockers() {
    const activeTasks = tasks.filter(task => task.status !== 'Done');
    const risks = activeTasks.map(task => ({ task, risk: taskRisk(task) }))
      .sort((a, b) => b.risk.score - a.risk.score);
    $('riskList').innerHTML = risks.length ? risks.map(({ task, risk }) =>
      `<article class="insight-item"><div><b>${escapeHtml(task.key)} · ${escapeHtml(task.title)}</b><span class="risk-badge ${risk.level.toLowerCase()}">${risk.level} risk · ${risk.score}</span></div><p>${escapeHtml(risk.reasons.join(' · ') || 'No immediate warning signals found.')}</p></article>`
    ).join('') : '<p class="empty">No open tasks to assess.</p>';

    const blocked = tasks.map(task => ({ task, reasons: blockerReasons(task) }))
      .filter(item => item.reasons.length)
      .sort((a, b) => b.reasons.length - a.reasons.length);
    $('blockerList').innerHTML = blocked.length ? blocked.map(({ task, reasons }) =>
      `<article class="insight-item blocker-item"><div><b>${escapeHtml(task.key)} · ${escapeHtml(task.title)}</b><span class="risk-badge high">Needs attention</span></div><p>${escapeHtml(reasons.join(' · '))}</p><button class="secondary" data-open-blocker="${task.id}">Review issue</button></article>`
    ).join('') : '<p class="empty">No likely blockers detected. In-progress items will be flagged after 3 days without a status change.</p>';
  }

  function renderWorkloadBalance() {
    const open = leafTasks().filter(task => task.status !== 'Done');
    const counts = members.map(member => ({
      member,
      count: open.filter(task => task.assignee === member.name).length
    })).sort((a, b) => b.count - a.count);
    if (counts.length < 2 || !counts[0].count) {
      $('balanceList').innerHTML = '<p class="empty">Add at least two members and assign open work to see workload suggestions.</p>';
      return;
    }
    const mostLoaded = counts[0];
    const leastLoaded = counts[counts.length - 1];
    if (mostLoaded.count - leastLoaded.count <= 1 || mostLoaded.count < 2) {
      $('balanceList').innerHTML = `<p class="balanced-message">Workload looks fairly even: ${counts.map(item => `${escapeHtml(item.member.name)} (${item.count})`).join(' · ')} open issues.</p>`;
      return;
    }
    const candidate = open.find(task => task.assignee === mostLoaded.member.name && task.status === 'To Do');
    const suggestion = candidate
      ? `<article class="insight-item"><div><b>${escapeHtml(mostLoaded.member.name)} has ${mostLoaded.count} open issues</b><span class="risk-badge medium">${escapeHtml(leastLoaded.member.name)} has ${leastLoaded.count}</span></div><p>Consider moving an unstarted issue to even out the queue.</p><button class="secondary" data-balance-task="${candidate.id}" data-balance-member="${leastLoaded.member.id}">Reassign ${escapeHtml(candidate.key)} to ${escapeHtml(leastLoaded.member.name)}</button></article>`
      : `<p class="balanced-message">${escapeHtml(mostLoaded.member.name)} has ${mostLoaded.count} open issues versus ${escapeHtml(leastLoaded.member.name)} (${leastLoaded.count}), but has no unstarted issues to suggest moving. Review the board before changing active assignments.</p>`;
    $('balanceList').innerHTML = suggestion;
  }

  function makeSubtaskSuggestions(task) {
    const sentences = task.description.split(/(?<=[.!?])\s+/).map(item => item.trim()).filter(Boolean);
    if (sentences.length > 1) return sentences.slice(0, 5).map(sentence => sentence.slice(0, 100));
    const title = task.title.replace(/[.!?]+$/, '');
    return [
      `Clarify requirements for: ${title}`,
      `Plan and implement: ${title}`,
      `Test the work for: ${title}`,
      `Review and document: ${title}`
    ];
  }

  function renderSplitTaskOptions() {
    const current = $('splitTask').value;
    const candidates = tasks.filter(task => !task.parentKey);
    $('splitTask').innerHTML = candidates.length
      ? candidates.map(task => `<option value="${task.id}">${escapeHtml(task.key)} · ${escapeHtml(task.title)}</option>`).join('')
      : '<option value="">No parent tasks available</option>';
    if (candidates.some(task => String(task.id) === current)) $('splitTask').value = current;
    $('generateSplit').disabled = !candidates.length;
  }

  function renderPulse() {
    const currentValue = $('pulseMember').value;
    const todaysPulses = pulses.filter(pulse => pulse.date === localToday());
    $('pulseMember').innerHTML = members.length
      ? members.map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join('')
      : '<option value="">Add a team member first</option>';
    if (members.some(member => String(member.id) === currentValue)) $('pulseMember').value = currentValue;
    else if (getCurrentMember()) $('pulseMember').value = String(getCurrentMember().id);
    const selectedPulse = todaysPulses.find(pulse => String(pulse.memberId) === $('pulseMember').value);
    $('pulseWorkload').value = selectedPulse ? String(selectedPulse.workload) : '3';
    $('pulseStress').value = selectedPulse ? String(selectedPulse.stress) : '2';
    $('pulseNote').value = selectedPulse ? selectedPulse.note : '';
    $('workloadValue').value = $('pulseWorkload').value;
    $('stressValue').value = $('pulseStress').value;
    $('pulseSummary').innerHTML = todaysPulses.length
      ? `<p>${todaysPulses.length} of ${members.length} team members checked in today · average workload ${average(todaysPulses.map(pulse => pulse.workload)).toFixed(1)}/5 · average stress ${average(todaysPulses.map(pulse => pulse.stress)).toFixed(1)}/5</p>${todaysPulses.map(pulse => { const member = members.find(item => item.id === pulse.memberId); return member ? `<div class="pulse-entry"><b>${escapeHtml(member.name)}</b><span>Workload ${pulse.workload}/5 · Stress ${pulse.stress}/5</span>${pulse.note ? `<p>${escapeHtml(pulse.note)}</p>` : ''}</div>` : ''; }).join('')}`
      : '<p>No check-ins today. Sharing a pulse is optional.</p>';
  }

  function average(numbers) {
    return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
  }

  function renderEco() {
    const doneRatio = tasks.length ? tasks.filter(task => task.status === 'Done').length / tasks.length : 0;
    const ecoRatio = ecoActions.length / 4;
    const score = Math.round(doneRatio * 30 + ecoRatio * 70);
    $('ecoScore').textContent = score;
    $('ecoSummary').textContent = `${ecoActions.length} of 4 paperless/sustainability practices checked · ${Math.round(doneRatio * 100)}% of issues complete. This is a self-reported indicator, not an environmental impact audit.`;
    $('ecoForm').querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = ecoActions.includes(input.value);
    });
  }

  function sprintForecast() {
    const sprint = sprints.find(item => String(item.id) === $('simSprint').value);
    if (!sprint) {
      $('simResult').innerHTML = '<p class="empty">Create a sprint to simulate its likely completion.</p>';
      return;
    }
    const sprintTasks = tasks.filter(task => task.sprintId === sprint.id);
    const completedPoints = sprintTasks.filter(task => task.status === 'Done').reduce((sum, task) => sum + task.estimatePoints, 0);
    const remainingPoints = sprintTasks.filter(task => task.status !== 'Done').reduce((sum, task) => sum + task.estimatePoints, 0);
    const addedPoints = Math.max(0, Math.min(100, Number($('simExtraPoints').value) || 0));
    const delayDays = Math.max(0, Math.min(30, Number($('simDelayDays').value) || 0));
    const capacityPerMember = Math.max(1, Math.min(100, Number($('simCapacity').value) || 1));
    const durationDays = Math.max(1, daysUntil(sprint.endDate, new Date(`${sprint.startDate}T12:00:00`)) + 1);
    const availableDays = Math.max(0, durationDays - delayDays);
    const availableCapacity = Math.round(members.length * capacityPerMember * availableDays / durationDays);
    const totalRemaining = remainingPoints + addedPoints;
    const forecast = totalRemaining ? Math.min(100, Math.round(availableCapacity / totalRemaining * 100)) : 100;
    const outlook = forecast >= 90 ? 'Looks achievable at the configured capacity.' : forecast >= 60 ? 'At risk: consider reducing scope or adding capacity.' : 'Unlikely at the configured capacity; review scope and timing.';
    $('simResult').innerHTML = `<div class="forecast-number">${forecast}%<small>estimated remaining work capacity</small></div><p>${escapeHtml(outlook)}</p><p>${completedPoints} points completed · ${remainingPoints} remaining + ${addedPoints} hypothetical · ${availableCapacity} points of modeled capacity after ${delayDays} delay day${delayDays === 1 ? '' : 's'}.</p><small>This simple estimate assumes evenly distributed team capacity. Adjust the inputs to explore scenarios.</small>`;
  }

  function renderInsights() {
    renderRisksAndBlockers();
    renderWorkloadBalance();
    renderSplitTaskOptions();
    renderPulse();
    renderEco();
    const priorSprint = $('simSprint').value;
    const eligibleSprints = sprints.filter(sprint => sprint.status !== 'Completed');
    $('simSprint').innerHTML = eligibleSprints.length
      ? eligibleSprints.map(sprint => `<option value="${sprint.id}">${escapeHtml(sprint.name)}</option>`).join('')
      : '<option value="">No planned or active sprints</option>';
    if (eligibleSprints.some(sprint => String(sprint.id) === priorSprint)) $('simSprint').value = priorSprint;
    sprintForecast();
  }

  function renderProfile() {
    const member = getCurrentMember();
    $('profileAvatar').textContent = member ? initials(member.name) : '?';
    $('profileText').innerHTML = member
      ? `${escapeHtml(member.name)}<br><small>Demo workspace</small>`
      : 'Guest<br><small>Demo workspace</small>';
    $('authButton').textContent = member ? 'Sign out' : 'Demo sign in';
  }

  function render() {
    const counts = countsByStatus();
    $('total').textContent = tasks.length;
    $('todo').textContent = counts['To Do'];
    $('progress').textContent = counts['In Progress'];
    $('done').textContent = counts.Done;
    const percent = tasks.length ? Math.round(counts.Done / tasks.length * 100) : 0;
    $('percent').textContent = `${percent}% of all issues`;
    $('bar').style.width = `${percent}%`;
    renderOverview(counts);
    renderBoard();
    renderTeam();
    renderSprints();
    renderReports(counts);
    renderInsights();
    renderProfile();
  }

  function switchView(view, updateHistory = true) {
    const validViews = ['overview', 'board', 'team', 'sprints', 'reports', 'insights'];
    const activeView = validViews.includes(view) ? view : 'overview';
    document.querySelectorAll('.view').forEach(section => {
      const active = section.id === activeView;
      section.hidden = !active;
      section.classList.toggle('hidden', !active);
    });
    document.querySelectorAll('.nav-link').forEach(link => {
      const active = link.dataset.view === activeView;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const labels = { overview: 'Overview', board: 'Project board', team: 'Team', sprints: 'Sprints', reports: 'Reports', insights: 'Smart insights' };
    $('breadcrumb').textContent = `Projects / Student Management System / ${labels[activeView]}`;
    $('createTop').hidden = activeView !== 'board';
    if (updateHistory && location.hash !== `#${activeView}`) location.hash = activeView;
  }

  function fillIssueOptions(task = null) {
    const assignee = $('assignee').value;
    $('assignee').innerHTML = '<option value="Unassigned">Unassigned</option>' +
      members.map(member => `<option value="${escapeHtml(member.name)}">${escapeHtml(member.name)}</option>`).join('');
    $('assignee').value = members.some(member => member.name === assignee) ? assignee : 'Unassigned';
    const estimatePoints = $('estimatePoints').value;
    $('estimatePoints').value = estimatePoints || '2';
    const sprintId = $('taskSprint').value;
    $('taskSprint').innerHTML = '<option value="">Backlog (no sprint)</option>' +
      sprints.filter(sprint => sprint.status !== 'Completed' || sprint.id === task?.sprintId).map(sprint =>
        `<option value="${sprint.id}">${escapeHtml(sprint.name)} · ${escapeHtml(sprint.status)}</option>`
      ).join('');
    $('taskSprint').value = sprints.some(sprint =>
      String(sprint.id) === sprintId && (sprint.status !== 'Completed' || sprint.id === task?.sprintId)
    ) ? sprintId : '';
  }

  function openForm(status = 'To Do', task = null) {
    $('form').reset();
    $('status').value = status;
    $('modalTitle').textContent = task ? `Edit ${task.key}` : 'Create issue';
    $('saveIssue').textContent = task ? 'Save changes' : 'Create issue';
    $('form').dataset.editId = task ? String(task.id) : '';
    fillIssueOptions(task);
    if (task) {
      $('title').value = task.title;
      $('description').value = task.description;
      $('type').value = task.type;
      $('priority').value = task.priority;
      $('status').value = task.status;
      $('assignee').value = task.assignee;
      $('dueDate').value = task.dueDate;
      $('estimatePoints').value = String(task.estimatePoints);
      $('taskSprint').value = task.sprintId ? String(task.sprintId) : '';
    }
    $('shade').classList.remove('hidden');
    $('title').focus();
  }

  function closeShade(id) {
    $(id).classList.add('hidden');
  }

  function exportCsv() {
    const columns = ['Key', 'Type', 'Summary', 'Description', 'Priority', 'Status', 'Assignee', 'Assignee email', 'Due date', 'Sprint', 'Story points', 'Parent', 'Comments'];
    const rows = tasks.map(task => [
      task.key, task.type, task.title, task.description, task.priority, task.status, task.assignee,
      members.find(member => member.name === task.assignee)?.email || '',
      task.dueDate, sprints.find(sprint => sprint.id === task.sprintId)?.name || '', task.estimatePoints, task.parentKey,
      task.comments.map(comment => `${comment.author}: ${comment.text}`).join(' | ')
    ]);
    const csv = [columns, ...rows].map(row => row.map(value => {
      const text = String(value);
      const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student-management-issues.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Issue report exported as CSV.');
  }

  function openAssignmentEmail(task) {
    const member = members.find(item => item.name === task.assignee);
    if (!member) return;
    if (member.email.toLowerCase().endsWith('@example.com')) {
      showToast(`Update ${member.name}'s example email address before preparing an assignment email.`);
      return;
    }
    const sprint = sprints.find(item => item.id === task.sprintId);
    const body = [
      `Hello ${member.name},`,
      '',
      `You have been assigned ${task.key}: ${task.title}.`,
      task.description ? `Details: ${task.description}` : '',
      task.dueDate ? `Due date: ${displayDate(task.dueDate)}` : '',
      sprint ? `Sprint: ${sprint.name}` : '',
      '',
      'This message was prepared by the local Jira-style demo.'
    ].filter(Boolean).join('\n');
    const href = `mailto:${member.email}?subject=${encodeURIComponent(`Assigned: ${task.key} ${task.title}`)}&body=${encodeURIComponent(body)}`;
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast(`Email draft prepared for ${member.email}. Review and send it in your mail app.`);
  }

  function openSplitForm(task) {
    const suggestions = makeSubtaskSuggestions(task);
    $('splitParent').textContent = `${task.key} · ${task.title}`;
    $('splitForm').dataset.parentId = String(task.id);
    $('splitInputs').innerHTML = suggestions.map((suggestion, index) =>
      `<label>Subtask ${index + 1}<input name="subtask" required maxlength="100" value="${escapeHtml(suggestion)}"></label>`
    ).join('');
    $('splitShade').classList.remove('hidden');
    $('splitInputs').querySelector('input').focus();
  }

  $('createTop').addEventListener('click', () => openForm());
  $('create').addEventListener('click', () => openForm());
  document.querySelectorAll('[data-close]').forEach(button =>
    button.addEventListener('click', () => closeShade(button.dataset.close))
  );
  document.querySelectorAll('.shade').forEach(shade => shade.addEventListener('click', event => {
    if (event.target === shade) closeShade(shade.id);
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.querySelectorAll('.shade:not(.hidden)').forEach(shade => closeShade(shade.id));
  });

  $('form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('title').value.trim();
    if (!title) return;
    const editId = Number($('form').dataset.editId);
    const existing = tasks.find(task => task.id === editId);
    const fields = {
      title,
      description: $('description').value.trim(),
      type: $('type').value,
      priority: $('priority').value,
      status: $('status').value,
      assignee: $('assignee').value,
      dueDate: $('dueDate').value,
      sprintId: Number($('taskSprint').value) || null,
      estimatePoints: Number($('estimatePoints').value) || 2
    };
    if (existing) {
      const assigneeChanged = existing.assignee !== fields.assignee;
      if (existing.status !== fields.status) existing.statusChangedAt = localToday();
      Object.assign(existing, fields);
      const persisted = save();
      render();
      closeShade('shade');
      if (persisted && assigneeChanged && fields.assignee !== 'Unassigned') openAssignmentEmail(existing);
      else if (persisted) showToast(`${existing.key} updated.`);
      return;
    }
    const id = nextId++;
    const task = { id, key: `SMS-${id}`, ...fields, statusChangedAt: localToday(), parentKey: '', comments: [] };
    tasks.unshift(task);
    const persisted = save();
    render();
    closeShade('shade');
    if (persisted && task.assignee !== 'Unassigned') openAssignmentEmail(task);
    else if (persisted) showToast(`Issue ${task.key} created.`);
  });

  $('columns').addEventListener('change', event => {
    const task = tasks.find(item => item.id === Number(event.target.dataset.status));
    if (!task) return;
    if (task.status !== event.target.value) task.statusChangedAt = localToday();
    task.status = event.target.value;
    const persisted = save();
    render();
    if (persisted) showToast(`${task.key} moved to ${task.status}.`);
  });

  $('columns').addEventListener('submit', event => {
    const form = event.target.closest('[data-comment-form]');
    if (!form) return;
    event.preventDefault();
    const task = tasks.find(item => item.id === Number(form.dataset.commentForm));
    const text = new FormData(form).get('comment').toString().trim();
    if (!task || !text) return;
    const member = getCurrentMember();
    task.comments.push({
      author: member ? member.name : 'Guest',
      text,
      date: new Date().toLocaleString()
    });
    expandedComments.add(task.id);
    const persisted = save();
    render();
    if (persisted) showToast('Comment added.');
  });

  $('columns').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.add) {
      openForm(button.dataset.add);
      return;
    }
    if (button.dataset.edit) {
      const task = tasks.find(item => item.id === Number(button.dataset.edit));
      if (task) openForm(task.status, task);
      return;
    }
    if (button.dataset.comments) {
      const id = Number(button.dataset.comments);
      if (expandedComments.has(id)) expandedComments.delete(id);
      else expandedComments.add(id);
      renderBoard();
      return;
    }
    if (button.dataset.email) {
      const task = tasks.find(item => item.id === Number(button.dataset.email));
      if (task) openAssignmentEmail(task);
      return;
    }
    if (button.dataset.split) {
      const task = tasks.find(item => item.id === Number(button.dataset.split));
      if (task) openSplitForm(task);
      return;
    }
    if (button.dataset.openBlocker) {
      switchView('board');
      const target = document.querySelector(`[data-edit="${Number(button.dataset.openBlocker)}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus();
      return;
    }
    if (button.dataset.delete) {
      const task = tasks.find(item => item.id === Number(button.dataset.delete));
      if (!task || !confirm(`Delete ${task.key}: "${task.title}"? This cannot be undone.`)) return;
      tasks = tasks.filter(item => item.id !== task.id);
      expandedComments.delete(task.id);
      const persisted = save();
      render();
      if (persisted) showToast(`${task.key} deleted.`);
    }
  });

  $('splitForm').addEventListener('submit', event => {
    event.preventDefault();
    const parent = tasks.find(task => task.id === Number($('splitForm').dataset.parentId));
    if (!parent) return;
    const suggestions = [...$('splitInputs').querySelectorAll('input[name="subtask"]')]
      .map(input => input.value.trim()).filter(Boolean);
    if (!suggestions.length) return;
    const perSubtaskPoints = Math.max(0.5, Math.round(parent.estimatePoints / suggestions.length * 10) / 10);
    const children = suggestions.map(title => ({
      id: nextId++,
      key: `SMS-${nextId - 1}`,
      type: 'Task',
      title,
      description: `Subtask of ${parent.key}: ${parent.title}`,
      priority: parent.priority,
      status: 'To Do',
      assignee: parent.assignee,
      dueDate: parent.dueDate,
      sprintId: parent.sprintId,
      estimatePoints: perSubtaskPoints,
      statusChangedAt: localToday(),
      parentKey: parent.key,
      comments: []
    }));
    tasks.unshift(...children);
    const persisted = save();
    render();
    closeShade('splitShade');
    if (persisted) showToast(`${children.length} subtasks created for ${parent.key}.`);
  });

  $('balanceList').addEventListener('click', event => {
    const button = event.target.closest('[data-balance-task]');
    if (!button) return;
    const task = tasks.find(item => item.id === Number(button.dataset.balanceTask));
    const member = members.find(item => item.id === Number(button.dataset.balanceMember));
    if (!task || !member || task.status !== 'To Do') return;
    task.assignee = member.name;
    const persisted = save();
    render();
    if (persisted) openAssignmentEmail(task);
  });

  $('blockerList').addEventListener('click', event => {
    const button = event.target.closest('[data-open-blocker]');
    if (!button) return;
    switchView('board');
    const target = document.querySelector(`[data-edit="${Number(button.dataset.openBlocker)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.focus();
  });

  $('generateSplit').addEventListener('click', () => {
    const task = tasks.find(item => item.id === Number($('splitTask').value));
    if (task) openSplitForm(task);
  });

  $('pulseWorkload').addEventListener('input', () => { $('workloadValue').value = $('pulseWorkload').value; });
  $('pulseStress').addEventListener('input', () => { $('stressValue').value = $('pulseStress').value; });
  $('pulseMember').addEventListener('change', renderPulse);
  $('pulseForm').addEventListener('submit', event => {
    event.preventDefault();
    const memberId = Number($('pulseMember').value);
    if (!members.some(member => member.id === memberId)) {
      showToast('Add a team member before submitting a check-in.');
      return;
    }
    const checkIn = {
      memberId,
      date: localToday(),
      workload: Number($('pulseWorkload').value),
      stress: Number($('pulseStress').value),
      note: $('pulseNote').value.trim()
    };
    const existing = pulses.findIndex(pulse => pulse.memberId === memberId && pulse.date === checkIn.date);
    if (existing >= 0) pulses[existing] = checkIn;
    else pulses.push(checkIn);
    const persisted = save();
    renderPulse();
    if (persisted) showToast('Daily team pulse saved in this browser.');
  });

  $('ecoForm').addEventListener('submit', event => {
    event.preventDefault();
    ecoActions = [...$('ecoForm').querySelectorAll('input[type="checkbox"]:checked')]
      .map(input => input.value);
    const persisted = save();
    renderEco();
    if (persisted) showToast('Sustainability actions saved.');
  });

  $('simulatorForm').addEventListener('input', sprintForecast);
  $('simulatorForm').addEventListener('change', sprintForecast);

  $('search').addEventListener('input', renderBoard);
  $('filter').addEventListener('change', renderBoard);
  $('filterType').addEventListener('change', renderBoard);
  $('clearFilters').addEventListener('click', () => {
    $('search').value = '';
    $('filter').value = 'all';
    $('filterType').value = 'all';
    renderBoard();
  });
  $('export').addEventListener('click', exportCsv);
  $('reportExport').addEventListener('click', exportCsv);
  $('reset').addEventListener('click', () => {
    if (!confirm('Reset the board and team to the original example data? Sprints, comments and changes will be cleared.')) return;
    tasks = seedTasks.map(task => ({ ...task, dueDate: '', sprintId: null, comments: [], estimatePoints: 2, statusChangedAt: localToday(), parentKey: '' }));
    members = seedMembers.map(member => ({ ...member }));
    sprints = [];
    currentEmail = '';
    pulses = [];
    ecoActions = [];
    nextId = 6;
    nextMemberId = 4;
    nextSprintId = 1;
    const persisted = save();
    render();
    if (persisted) showToast('Example project data reset.');
  });

  $('addMember').addEventListener('click', () => {
    editingMemberId = null;
    $('memberForm').reset();
    $('memberModalTitle').textContent = 'Add team member';
    $('memberShade').classList.remove('hidden');
    $('memberName').focus();
  });
  $('memberForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('memberName').value.trim();
    const email = $('memberEmail').value.trim().toLowerCase();
    if (!name || !email) return;
    if (members.some(member => member.email.toLowerCase() === email && member.id !== editingMemberId)) {
      showToast('A team member with that email already exists.');
      return;
    }
    if (members.some(member => member.name.toLowerCase() === name.toLowerCase() && member.id !== editingMemberId)) {
      showToast('A team member with that name already exists.');
      return;
    }
    const editing = members.find(member => member.id === editingMemberId);
    if (editing) {
      const oldName = editing.name;
      const oldEmail = editing.email;
      editing.name = name;
      editing.email = email;
      tasks.forEach(task => { if (task.assignee === oldName) task.assignee = name; });
      if (currentEmail.toLowerCase() === oldEmail.toLowerCase()) currentEmail = email;
    } else {
      members.push({ id: nextMemberId++, name, email });
    }
    const persisted = save();
    render();
    closeShade('memberShade');
    if (persisted) showToast(editing ? 'Team member updated.' : 'Team member added.');
  });
  $('teamList').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.memberEdit) {
      const member = members.find(item => item.id === Number(button.dataset.memberEdit));
      if (!member) return;
      editingMemberId = member.id;
      $('memberName').value = member.name;
      $('memberEmail').value = member.email;
      $('memberModalTitle').textContent = 'Edit team member';
      $('memberShade').classList.remove('hidden');
      $('memberName').focus();
    }
    if (button.dataset.memberDelete) {
      const member = members.find(item => item.id === Number(button.dataset.memberDelete));
      if (!member || !confirm(`Remove ${member.name} from the team? Their assigned issues will become unassigned.`)) return;
      tasks.forEach(task => { if (task.assignee === member.name) task.assignee = 'Unassigned'; });
      members = members.filter(item => item.id !== member.id);
      pulses = pulses.filter(pulse => pulse.memberId !== member.id);
      if (currentEmail.toLowerCase() === member.email.toLowerCase()) currentEmail = '';
      const persisted = save();
      render();
      if (persisted) showToast(`${member.name} removed from the team.`);
    }
  });

  $('sprintForm').addEventListener('submit', event => {
    event.preventDefault();
    const startDate = $('sprintStart').value;
    const endDate = $('sprintEnd').value;
    if (endDate < startDate) {
      $('sprintEnd').setCustomValidity('End date must be on or after the start date.');
      $('sprintEnd').reportValidity();
      return;
    }
    $('sprintEnd').setCustomValidity('');
    sprints.push({
      id: nextSprintId++,
      name: $('sprintName').value.trim(),
      goal: $('sprintGoal').value.trim(),
      startDate,
      endDate,
      status: 'Planned'
    });
    const persisted = save();
    $('sprintForm').reset();
    render();
    if (persisted) showToast('Sprint planned.');
  });
  $('sprintEnd').addEventListener('input', () => $('sprintEnd').setCustomValidity(''));
  $('sprintList').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.sprintState) {
      const sprint = sprints.find(item => item.id === Number(button.dataset.sprintState));
      if (!sprint) return;
      sprint.status = sprint.status === 'Planned' ? 'In Progress' : 'Completed';
      const persisted = save();
      render();
      if (persisted) showToast(`${sprint.name} is ${sprint.status.toLowerCase()}.`);
    }
    if (button.dataset.sprintDelete) {
      const sprint = sprints.find(item => item.id === Number(button.dataset.sprintDelete));
      if (!sprint || !confirm(`Delete ${sprint.name}? Its issues will return to the backlog.`)) return;
      tasks.forEach(task => { if (task.sprintId === sprint.id) task.sprintId = null; });
      sprints = sprints.filter(item => item.id !== sprint.id);
      const persisted = save();
      render();
      if (persisted) showToast(`${sprint.name} deleted.`);
    }
  });

  $('authButton').addEventListener('click', () => {
    const member = getCurrentMember();
    if (member) {
      currentEmail = '';
      const persisted = save();
      renderProfile();
      if (persisted) showToast('Signed out of the local demo profile.');
      return;
    }
    authMode = 'login';
    $('authTitle').textContent = 'Demo sign in';
    $('authSubmit').textContent = 'Continue';
    $('authMode').textContent = 'Create profile';
    $('authForm').reset();
    $('authNameField').hidden = true;
    $('authName').required = false;
    $('authShade').classList.remove('hidden');
    $('authEmail').focus();
  });
  $('authMode').addEventListener('click', () => {
    authMode = authMode === 'login' ? 'signup' : 'login';
    $('authTitle').textContent = authMode === 'login' ? 'Demo sign in' : 'Create local profile';
    $('authSubmit').textContent = authMode === 'login' ? 'Continue' : 'Create profile';
    $('authMode').textContent = authMode === 'login' ? 'Create profile' : 'Back to sign in';
    $('authNameField').hidden = authMode !== 'signup';
    $('authName').required = authMode === 'signup';
  });
  $('authForm').addEventListener('submit', event => {
    event.preventDefault();
    const email = $('authEmail').value.trim().toLowerCase();
    const name = $('authName').value.trim();
    let member = members.find(item => item.email.toLowerCase() === email);
    if (authMode === 'signup') {
      if (member) {
        showToast('That email already has a local profile. Sign in instead.');
        return;
      }
      if (members.some(item => item.name.toLowerCase() === name.toLowerCase())) {
        showToast('A team member with that name already exists.');
        return;
      }
      member = { id: nextMemberId++, name, email };
      members.push(member);
    } else if (!member) {
      showToast('No local profile found for that email. Create a profile first.');
      return;
    }
    currentEmail = member.email;
    const persisted = save();
    render();
    closeShade('authShade');
    if (persisted) showToast(`Welcome, ${member.name}.`);
  });

  $('themeToggle').addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark-mode');
    $('themeToggle').textContent = dark ? '☀ Light mode' : '☾ Dark mode';
    $('themeToggle').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    try {
      localStorage.setItem(themeKey, dark ? 'dark' : 'light');
    } catch (error) {
      showToast('Theme changed for this session but could not be saved.');
    }
  });
  document.querySelectorAll('.nav-link, .text-link').forEach(link => {
    link.addEventListener('click', () => switchView(link.getAttribute('href').slice(1)));
  });
  window.addEventListener('hashchange', () => switchView(location.hash.slice(1), false));
  try {
    if (localStorage.getItem(themeKey) === 'dark') {
      document.body.classList.add('dark-mode');
      $('themeToggle').textContent = '☀ Light mode';
      $('themeToggle').setAttribute('aria-label', 'Switch to light mode');
    }
  } catch (error) {
    showToast('Could not restore the saved theme preference.');
  }
  render();
  switchView(location.hash.slice(1) || 'overview', false);
})();
