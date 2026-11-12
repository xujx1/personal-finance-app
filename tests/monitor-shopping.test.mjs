import test from 'node:test';import assert from 'node:assert/strict';
import {classifyExpense} from '../src/domain/expense-plan.mjs';import {publicResearchQuery} from '../src/domain/public-query.mjs';
test('buying a 2K monitor is shopping without a manual type choice',()=>{
 const question='买显示器，2k，预算1000以内';assert.equal(classifyExpense(question).kind,'shopping');const query=publicResearchQuery({kind:'shopping',question});assert.match(query,/显示器/);assert.match(query,/2K/i);
});
