import {getChatGPTUser} from '../chatgpt-auth';
import FamilyPanel from '../../components/FamilyPanel';
export const dynamic='force-dynamic';
export default async function Join(){const user=await getChatGPTUser();return <main style={{maxWidth:900,margin:'32px auto',padding:24}}><FamilyPanel loggedIn={Boolean(user)} joinOnly/></main>}
