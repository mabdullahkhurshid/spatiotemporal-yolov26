import AppShell from '../components/shell/AppShell';

// Every signed-in role shares one shell; navigation is chosen from the user's role.
const OperatorLayout = () => <AppShell />;

export default OperatorLayout;
