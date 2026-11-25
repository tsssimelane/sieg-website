import app,{verifyAnalysisSetup} from '../cloudflare-dist/app.js';
import {createHandler} from './edge.js';
export default {fetch:createHandler(app,verifyAnalysisSetup)};
