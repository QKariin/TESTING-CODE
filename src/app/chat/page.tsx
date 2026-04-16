// Chatter chat page - renders the full dashboard in chatter mode.
// Role detection happens automatically via /api/chatter/role which returns 'chatter',
// causing the dashboard to hide email-sensitive panels (Leads, Chatters management).
// Everything else (sidebar, chat, dossier card, tasks, modals) works identically.
import DashboardPage from '../dashboard/page';
export default DashboardPage;
