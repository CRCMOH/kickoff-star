import { captaincyScore, evaluateCaptaincy, recordCaptainAppearance, type CaptaincyState } from '../src/engine/captaincy'

const base:any={
 id:'p',name:'Test',position:'CM',preferredFoot:'right',heightCm:178,attributes:{},potential:70,
 confidence:{value:0,baseline:0},fitness:{stamina:100},careerClock:{ageYears:17,phase:'academy',grassrootsSeason:null},
 schoolId:null,trialWeekCompleted:3,trainingMomentum:0,matchRatings:[],seasonGoals:0,seasonAssists:0,
 injury:null,recentInjuryCount:0,matchesSinceReturn:3,coachTrust:0,reputation:5,scoutWatchers:[],contractOffers:[],
 totalWeeksElapsed:20,academyClubName:'Test',turnedPro:null,squadRole:'starting-xi',seasonAppearances:0,seasonRatings:[],
 standing:{coach:0,teammates:0,fans:0},
}
const rookie={...base,coachTrust:10,seasonAppearances:3,seasonRatings:[8,8,8],standing:{coach:8,teammates:8,fans:8}}
if(evaluateCaptaincy(rookie).role!=='none')throw new Error('Captaincy awarded too early to rookie')
const established={...base,coachTrust:9,seasonAppearances:12,seasonRatings:[7.5,7.7,7.4,7.8,7.6,7.5],standing:{coach:8,teammates:8,fans:5}}
const vice=evaluateCaptaincy(established)
if(vice.role==='none')throw new Error('Established leader never reaches leadership group')
let promoted:CaptaincyState={...vice,role:'vice-captain'}
promoted=evaluateCaptaincy(established,promoted)
if(promoted.role!=='captain')throw new Error('Elite established vice-captain cannot earn captaincy')
const oneBad={...established,coachTrust:3,seasonRatings:[7.5,7.7,7.4,7.8,7.6,5.5]}
if(evaluateCaptaincy(oneBad,promoted).role!=='captain')throw new Error('One poor match stripped captaincy')
const counted=recordCaptainAppearance(promoted)
if(counted.matchesAsCaptain!==promoted.matchesAsCaptain+1)throw new Error('Captain appearance not recorded')
console.log('CAPTAINCY AUDIT PASSED',{rookie:captaincyScore(rookie),established:captaincyScore(established),role:promoted.role})
