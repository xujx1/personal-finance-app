import {requireChatGPTUser} from './chatgpt-auth';
import FinanceApp from '../components/FinanceApp';
import {planIdFromValue} from '../src/domain/plan-approval-view.mjs';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const plan=planIdFromValue((await searchParams).plan);const user=await requireChatGPTUser(plan?'/?plan='+encodeURIComponent(plan):'/');return <FinanceApp displayName={user.displayName} email={user.email}/>;}
