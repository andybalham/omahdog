import { Type } from './Type';

export class FlowDefinition<TFlowReq, TFlowRes, TState> {
    initialiseState?: (request: TFlowReq, state: TState) => void;
    bindResponse?: (response: TFlowRes, state: TState) => void;
    steps: FlowStep[] = [];
}

export enum FlowStepType {
    Activity = 'Activity',
    Decision = 'Decision',
    Goto = 'Goto',
    Label = 'Label',
    End = 'End'
}

export abstract class FlowStep {

    constructor(type: FlowStepType, name?: string) {
        this.type = type;
        this.name = name;
    }

    readonly type: FlowStepType;
    readonly name?: string;
}

export class ActivityFlowStep<TReq, TRes, TState> extends FlowStep {

    constructor(stepName: string, requestType?: Type<TReq>, responseType?: Type<TRes>,
        bindRequest?: (request: TReq, state: TState) => void, bindState?: (response: TRes, state: TState) => void) {

        super(FlowStepType.Activity, stepName);

        this.requestType = requestType;
        this.responseType = responseType;
        this.bindRequest = bindRequest;
        this.bindState = bindState;
    }

    readonly requestType?: Type<TReq>;
    readonly responseType?: Type<TRes>;
    readonly bindRequest?: (request: TReq, state: TState) => void;
    readonly bindState?: (response: TRes, state: TState) => void;
}

export abstract class DecisionFlowStepBase extends FlowStep {

    constructor(stepName: string) {
        super(FlowStepType.Decision, stepName);
    }

    abstract get caseSummaries(): DecisionBranchSummary[];
    abstract get elseSummary(): DecisionBranchSummary;
}

export class DecisionFlowStep<TDecision, TState> extends DecisionFlowStepBase {

    constructor(stepName: string, getValue: (state: TState) => TDecision) {

        super(stepName);

        this.getValue = getValue;
        this.caseBranches = [];
        this.elseBranch = new ElseDecisionBranch();
    }

    readonly getValue: (state: TState) => TDecision;
    readonly caseBranches: CaseDecisionBranch<TDecision>[];
    readonly elseBranch: ElseDecisionBranch;

    get caseSummaries(): DecisionBranchSummary[] {
        return this.caseBranches.map(b => { return { target: b.target, description: b.description }; });
    }

    get elseSummary(): DecisionBranchSummary {
        return { target: this.elseBranch.target, description: 'Else' };
    }
}

export class EndFlowStep extends FlowStep {
    constructor() {
        super(FlowStepType.End);
    }
}

export class LabelFlowStep extends FlowStep {
    constructor(stepName: string) {
        super(FlowStepType.Label, stepName);
    }
}

export class GotoFlowStep extends FlowStep {
    constructor(targetStepName: string) {
        super(FlowStepType.Goto);
        this.targetStepName = targetStepName;
    }
    readonly targetStepName: string;
}

export class DecisionBranch {
    target?: DecisionBranchTarget;
    description?: string;
}

export class CaseDecisionBranch<TDecision> extends DecisionBranch {
    readonly isTrue?: (value: TDecision) => boolean;
}

export class ElseDecisionBranch extends DecisionBranch {
}

export enum DecisionBranchTargetType {
    Goto = 'Goto',
    Continue = 'Continue',
    End = 'End',
    Error = 'Error',
}

export class DecisionBranchTarget {
    readonly type?: DecisionBranchTargetType;
    readonly stepName?: string;
    readonly getErrorMessage?: (decisionValue: any) => string;
}

export class DecisionBranchSummary {
    readonly target?: DecisionBranchTarget;
    readonly description?: string;
}
