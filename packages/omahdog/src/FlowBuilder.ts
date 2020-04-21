import { FlowDefinition, ActivityFlowStep, DecisionFlowStep, LabelFlowStep, GotoFlowStep, EndFlowStep, CaseDecisionBranch, DecisionBranchTargetType, ElseDecisionBranch } from './FlowDefinition';

export class FlowBuilder<TFlowReq, TFlowRes, TState> {

    private flowDefinition = new FlowDefinition<TFlowReq, TFlowRes, TState>();

    // TODO 07Mar20: Can we force initialise() to be first?

    initialise(initialiseState: (request: TFlowReq, state: TState) => void): FlowBuilder<TFlowReq, TFlowRes, TState> {
        this.flowDefinition.initialiseState = initialiseState;
        return this;
    }

    finalise(bindResponse: (response: TFlowRes, state: TState) => void): FlowDefinition<TFlowReq, TFlowRes, TState> {
        this.flowDefinition.bindResponse = bindResponse;
        return this.flowDefinition;
    }

    perform<TReq, TRes>(stepName: string, RequestType: new () => TReq, ResponseType: new () => TRes,
        bindRequest: (request: TReq, state: TState) => void, bindState?: (response: TRes, state: TState) => void): FlowBuilder<TFlowReq, TFlowRes, TState> {

        bindState = (bindState === undefined) ? (_res, _state): void => { } : bindState;

        const activityFlowStep = new ActivityFlowStep(stepName, RequestType, ResponseType, bindRequest, bindState);

        this.flowDefinition.steps.push(activityFlowStep);

        return this;
    }

    setState(stepName: string, setState: (state: any) => void): FlowBuilder<TFlowReq, TFlowRes, TState> {

        const bindRequest = (_req, _state): void => { };
        const bindState = (_res, state): void => { setState(state); };

        const activityFlowStep = new ActivityFlowStep(stepName, undefined, undefined, bindRequest, bindState);

        this.flowDefinition.steps.push(activityFlowStep);

        return this;
    }

    evaluate<TDecision>(stepName: string, getValue: (state: TState) => TDecision,
        buildCases: (cases: SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>) => void): SwitchElseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        const decisionFlowStep = new DecisionFlowStep(stepName, getValue);

        const switchCaseBuilder = new SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>(decisionFlowStep.caseBranches);
        buildCases(switchCaseBuilder);

        this.flowDefinition.steps.push(decisionFlowStep);

        return new SwitchElseBuilder(this, decisionFlowStep);
    }

    label(stepName: string): FlowBuilder<TFlowReq, TFlowRes, TState> {
        const labelFlowStep = new LabelFlowStep(stepName);
        this.flowDefinition.steps.push(labelFlowStep);
        return this;
    }

    goto(stepName: string): FlowBuilder<TFlowReq, TFlowRes, TState> {
        const gotoFlowStep = new GotoFlowStep(stepName);
        this.flowDefinition.steps.push(gotoFlowStep);
        return this;
    }

    end(): FlowBuilder<TFlowReq, TFlowRes, TState> {
        this.flowDefinition.steps.push(new EndFlowStep());
        return this;
    }
}

export class SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

    private branches: CaseDecisionBranch<TDecision>[] = [];

    constructor(branches: CaseDecisionBranch<TDecision>[]) {
        this.branches = branches;
    }

    // TODO 05Apr20: Add whenEqual, and allow for multiple values

    // TODO 05Apr20: Allow for description, for use in diagrams

    when(isTrue: (switchValue: TDecision) => boolean, description?: string): SwitchCaseTargetBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        const branch: CaseDecisionBranch<TDecision> = {
            isTrue: isTrue,
            description: description
        };

        this.branches.push(branch);

        return new SwitchCaseTargetBuilder(this, branch);
    }

    // TODO 06Apr20: Allow for multiple values

    whenEqual(targetValue: TDecision): SwitchCaseTargetBuilder<TDecision, TFlowReq, TFlowRes, TState> {
        // TODO 13Apr20: Why can't we call toString on targetValue?
        return this.when(v => v === targetValue, `${targetValue}`);
    }
}

export class SwitchElseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

    private builder: FlowBuilder<TFlowReq, TFlowRes, TState>;
    private step: DecisionFlowStep<TDecision, TState>;

    constructor(builder: FlowBuilder<TFlowReq, TFlowRes, TState>, step: DecisionFlowStep<TDecision, TState>) {
        this.step = step;
        this.builder = builder;
    }

    else(): SwitchElseTargetBuilder<TFlowReq, TFlowRes, TState> {
        return new SwitchElseTargetBuilder(this.builder, this.step.elseBranch);
    }
}

export class SwitchCaseTargetBuilder<TDecision, TFlowReq, TFlowRes, TState> {

    private builder: SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>;
    private branch: CaseDecisionBranch<TDecision>;

    constructor(builder: SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>, branch: CaseDecisionBranch<TDecision>) {
        this.builder = builder;
        this.branch = branch;
    }

    goto(stepName: string): SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.Goto,
            stepName: stepName
        };

        return this.builder;
    }

    continue(): SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.Continue
        };

        return this.builder;
    }

    end(): SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.End
        };

        return this.builder;
    }
}

export class SwitchElseTargetBuilder<TFlowReq, TFlowRes, TState> {

    private branch: ElseDecisionBranch;
    private builder: FlowBuilder<TFlowReq, TFlowRes, TState>;

    constructor(builder: FlowBuilder<TFlowReq, TFlowRes, TState>, branch: ElseDecisionBranch) {
        this.branch = branch;
        this.builder = builder;
    }

    goto(stepName: string): FlowBuilder<TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.Goto,
            stepName: stepName
        };

        return this.builder;
    }

    continue(): FlowBuilder<TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.Continue
        };

        return this.builder;
    }

    end(): FlowBuilder<TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.End
        };

        return this.builder;
    }

    error(getErrorMessage?: (decisionValue: any) => string): FlowBuilder<TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.Error,
            getErrorMessage: getErrorMessage
        };

        return this.builder;
    }
}
