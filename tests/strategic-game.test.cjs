const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateRound } = require('../strategic-game.js');

const firm = {transferPricing:false,thinCapitalisation:false,exportMispricing:false,interestRate:10};
const govt = {citRate:20,royaltyRate:5,armLength:false,thinCap:false,earningsStripping:false,withholding:false,exportAudit:false};

test('baseline CIT = 15 and royalty = 15',()=>{
 const x=calculateRound(firm,govt);
 assert.equal(x.cit,15);
 assert.equal(x.royalty,15);
 assert.equal(x.stateGross,30);
 assert.equal(x.shareholderAnnualIncome,60);
});

test('interest limitation changes deduction, not paid interest',()=>{
 const f={...firm,thinCapitalisation:true,debtLevel:900};
 const x=calculateRound(f,{...govt,thinCap:true,thinCapRatio:4});
 assert.equal(x.actualInterest,90);
 assert.equal(x.deductibleInterest,40);
 assert.equal(x.disallowedInterest,50);
});

test('export audit restores sales tax base',()=>{
 const f={...firm,exportMispricing:true,exportDiscount:40};
 const before=calculateRound(f,govt);
 const after=calculateRound(f,{...govt,exportAudit:true});
 assert.equal(before.declaredSales,180);
 assert.equal(after.correctedSales,300);
 assert.ok(after.stateGross>before.stateGross);
});

test('administrative capacity is binding',()=>{
 assert.throws(()=>calculateRound(firm,{...govt,armLength:true,thinCap:true,earningsStripping:true,withholding:true,exportAudit:true}),/capacity exceeded/);
});

test('non-finite values are rejected',()=>{
 assert.throws(()=>calculateRound({...firm,interestRate:NaN},govt),/finite/);
});
