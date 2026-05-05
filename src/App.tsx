import { LogProvider } from './store/logStore';
import AppLayout from './components/AppLayout';

function App() {
  return (
    <LogProvider>
      <AppLayout />
    </LogProvider>
  );
}

export default App;