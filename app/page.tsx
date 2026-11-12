import {requireChatGPTUser} from './chatgpt-auth';
import FinanceApp from '../components/FinanceApp';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');return <FinanceApp displayName={user.displayName} email={user.email}/>;}
