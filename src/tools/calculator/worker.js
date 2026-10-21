import { calculate, officeCalculation } from './core.js';
self.onmessage=({data})=>{
  try {const result=data.mode?officeCalculation(data.mode,data.first,data.second):calculate(data.input,{angleUnit:data.angleUnit,ans:data.ans});self.postMessage({taskId:data.taskId,status:'ready',result});}
  catch(error){self.postMessage({taskId:data.taskId,status:'error',code:error.code||'calculator.invalidExpression',params:error.params||{}});}
};
