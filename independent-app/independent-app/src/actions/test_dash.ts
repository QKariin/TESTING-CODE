import { getAdminDashboardData } from './velo-actions';

async function test() {
    console.log("Testing dashboard data fetch...");
    try {
        const data = await getAdminDashboardData();
        console.log("Success! Users count:", data.users?.length);
    } catch (e) {
        console.log("Error:", e);
    }
}
test();
