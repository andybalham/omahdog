import fs = require('fs');
import { FlowBuilder } from './FlowBuilder';
import { FlowDefinition, FlowStepType, DecisionBranchTarget, DecisionBranch, DecisionBranchTargetType, FlowStep, GotoFlowStep, DecisionFlowStepBase, DecisionBranchSummary } from './FlowDefinition';
import { IActivityRequestHandler } from './FlowHandlers';
import { FlowContext, FlowInstanceStackFrame } from './FlowContext';

export abstract class FlowRequestHandler<TReq, TRes, TState> implements IActivityRequestHandler<TReq, TRes> {

    abstract flowName: string;

    private readonly ResponseType: new () => TRes;
    private readonly StateType: new () => TState;
    private readonly flowDefinition: FlowDefinition<TReq, TRes, TState>;

    constructor(ResponseType: new () => TRes, StateType: new () => TState) {

        this.ResponseType = ResponseType;
        this.StateType = StateType;

        this.flowDefinition = this.buildFlow(new FlowBuilder<TReq, TRes, TState>());
    }

    abstract buildFlow(flowBuilder: FlowBuilder<TReq, TRes, TState>): FlowDefinition<TReq, TRes, TState>;

    appendDiagram(fileName: string): void {

        function append(text: string): void { fs.appendFileSync(fileName, text); }
        function appendLine(text: string): void { append(`${text}\n`); }

        appendLine(`# ${this.flowName}`);
        appendLine('');
        appendLine('```mermaid');
        appendLine('graph TB');

        const visitedNodes = new Set<string>();

        function appendNodes(stepIndex: number, flowDefinition: FlowDefinition<TReq, TRes, TState>): void {

            if (stepIndex === flowDefinition.steps.length) {
                appendLine('_End_([End])');
                return;
            }

            const step = flowDefinition.steps[stepIndex];

            if (step.name !== undefined) {

                if (visitedNodes.has(step.name)) {
                    appendLine(`${getCanonicalName(step.name)}`);
                    return;
                }

                visitedNodes.add(step.name);
            }

            switch (step.type) {

            case FlowStepType.Activity:
                appendLine(`${getCanonicalName(step.name)}["${step.name}"] --> `);
                appendNodes(stepIndex + 1, flowDefinition);
                break;

            case FlowStepType.Label:
                appendLine(`${getCanonicalName(step.name)}[/"${step.name}"\\] --> `);
                appendNodes(stepIndex + 1, flowDefinition);
                break;

            case FlowStepType.Goto:
                {                
                    const gotoStep = step as GotoFlowStep;
                    const targetIndex = flowDefinition.steps.findIndex(step => step.name === gotoStep.targetStepName);
                    appendNodes(targetIndex, flowDefinition);
                }
                break;

            case FlowStepType.End:
                appendLine('_End_([End])');
                break;

            case FlowStepType.Decision:
                {
                    const decisionStep = step as DecisionFlowStepBase;
                    for (const summaries of decisionStep.caseSummaries) {
                        addBranch(summaries);
                    }
                    addBranch(decisionStep.elseSummary);
                }                
                break;

            default:
                throw new Error(`Unhandled step.type: ${step.type}`);
            }

            function getCanonicalName(name?: string): string | undefined { return name?.replace(/[^a-zA-Z_]/gi, '_'); }

            function addBranch(summary: DecisionBranchSummary): void {

                if (!summary) throw new Error('summary is undefined');
                if (!summary.target) throw new Error('summary.target is undefined');

                if (summary.target.type === DecisionBranchTargetType.Error) {
                    return;
                }
                
                append(`${getCanonicalName(step.name)}{{"${step.name}"}} --`);

                if (summary.description && summary.description.length > 0) {
                    appendLine(` "${summary.description}" -->`);                    
                } else {
                    appendLine('>');
                }

                switch (summary.target.type) {

                case DecisionBranchTargetType.Continue:
                    appendNodes(stepIndex + 1, flowDefinition);
                    break;

                case DecisionBranchTargetType.Goto:
                    {
                        const targetStepName = summary.target.stepName;
                        const targetIndex = flowDefinition.steps.findIndex(step => step.name === targetStepName);
                        appendNodes(targetIndex, flowDefinition);
                    }                    
                    break;

                case DecisionBranchTargetType.End:
                    appendLine('_End_([End])');
                    break;

                default:
                    break;
                }
            }
        }

        if (this.flowDefinition.steps.length > 0) {
            appendNodes(0, this.flowDefinition);
        }

        appendLine('```');
    }

    async handle(flowContext: FlowContext, request?: TReq): Promise<TRes | undefined> {

        let wasResume: boolean;
        let isRoot: boolean;

        if (flowContext.isResume) {

            wasResume = flowContext.isResume;
            
            if (!flowContext.resumeStackFrames) throw new Error('flowContext.resumeStackFrames is undefined');
            isRoot = (flowContext.resumeStackFrames.length === flowContext.initialResumeStackFrameCount);
            const resumeStackFrame = flowContext.resumeStackFrames.pop();
            
            if (!resumeStackFrame) throw new Error('resumeStackFrame is undefined');
            flowContext.stackFrames.push(resumeStackFrame);

        } else {

            wasResume = false;
            isRoot = (flowContext.stackFrames.length === 0);
            flowContext.stackFrames.push(new FlowInstanceStackFrame(this.flowName, new this.StateType()));
            
        }

        const response = await this.performFlow(flowContext, this.flowDefinition, request);

        const hasResponse = response !== undefined;

        if (hasResponse) {

            flowContext.stackFrames.pop();

            if (isRoot && wasResume) {
                await flowContext.deleteInstance();
            }

        } else if (isRoot) {

            await flowContext.saveInstance();
        }

        return response;
    }

    protected debugPreStepState(_stepName?: string, _state?: any): void { }
    protected debugPreActivityRequest(_stepName?: string, _request?: any, _state?: any): void { }
    protected debugPostActivityResponse(_stepName?: string, _response?: any, _state?: any): void { }
    protected debugPostStepState(_stepName?: string, _state?: any): void { }

    private async performFlow(flowContext: FlowContext, flowDefinition: FlowDefinition<TReq, TRes, TState>, request?: TReq): Promise<TRes | undefined> {

        let stepIndex: number | undefined;

        if (flowContext.isResume) {
            if (!flowContext?.currentStackFrame?.stepName) throw new Error('flowContext.currentStackFrame.stepName is undefined');
            stepIndex = this.getStepIndex(flowContext.currentStackFrame.stepName, this.flowDefinition);
        } else {
            if (!flowDefinition.initialiseState) throw new Error('flowDefinition.initialiseState is undefined');
            if (!request) throw new Error('request is undefined');
            flowDefinition.initialiseState(request, flowContext.currentStackFrame.state);
            stepIndex = 0;
        }

        while ((stepIndex !== undefined) && (stepIndex < flowDefinition.steps.length)) {

            const step = flowDefinition.steps[stepIndex];

            flowContext.currentStackFrame.stepName = step.name;

            // TODO 08Mar20: Should all logging be done via the FlowContext? I.e. assign an ILogger implementation

            this.debugPreStepState(step.name, flowContext.currentStackFrame.state);

            switch (step.type) {

            case FlowStepType.Activity:

                if (flowContext.isResume) {
                    if (!flowContext.resumeStackFrames) throw new Error('flowContext.resumeStackFrames is undefined');
                    
                    if ((flowContext.resumeStackFrames.length === 0) && (step.name === flowContext.currentStackFrame.stepName)) {
                        stepIndex = this.resumeActivity(flowContext, stepIndex, step);                        
                    } else {
                        stepIndex = await this.performActivity(flowContext, stepIndex, step);                        
                    }
                }
                else {
                    stepIndex = await this.performActivity(flowContext, stepIndex, step);
                }
                break;

            case FlowStepType.Decision:
                stepIndex = this.evaluateDecision(stepIndex, step, flowContext.currentStackFrame.state, flowDefinition);
                break;

            case FlowStepType.End:
                stepIndex = this.gotoEnd();
                break;

            case FlowStepType.Label:
                stepIndex = this.skipLabel(stepIndex, step);
                break;

            case FlowStepType.Goto:
                stepIndex = this.gotoTarget(step as GotoFlowStep, flowDefinition);
                break;

            default:
                throw new Error(`Unhandled FlowStepType: ${step.type}`);
            }

            this.debugPostStepState(step.name, flowContext.currentStackFrame.state);
        }

        if (stepIndex === undefined) {
            return undefined;
        }

        const response = new this.ResponseType();
        if (!flowDefinition.bindResponse) throw new Error('flowDefinition.bindResponse is undefined');
        flowDefinition.bindResponse(response, flowContext.currentStackFrame.state);
        return response;
    }

    gotoTarget(step: GotoFlowStep, flowDefinition: FlowDefinition<TReq, TRes, TState>): number {
        const nextStepIndex = this.getStepIndex(step.targetStepName, flowDefinition);
        return nextStepIndex;
    }

    skipLabel(stepIndex: number, _step: FlowStep): number {
        return stepIndex + 1;
    }

    private gotoEnd(): number {
        return Number.MAX_SAFE_INTEGER;
    }

    private evaluateDecision(stepIndex: number, step: any, state: TState, flowDefinition: FlowDefinition<TReq, TRes, TState>): number {

        const decisionValue = step.getValue(state);

        let trueBranch: any;

        for (const caseBranch of step.caseBranches) {

            if (caseBranch.isTrue(decisionValue)) {
                trueBranch = caseBranch;
                break;
            }
        }

        const decisionBranch: DecisionBranch = (trueBranch === undefined) ? step.elseBranch : trueBranch;

        if (!decisionBranch.target) throw new Error('decisionBranch.target is undefined');

        const nextStepIndex = this.getNextStepIndex(decisionBranch.target, stepIndex, flowDefinition, decisionValue);

        return nextStepIndex;
    }

    private getNextStepIndex(target: DecisionBranchTarget, currentStepIndex: number, flowDefinition: FlowDefinition<TReq, TRes, TState>, decisionValue: any): number {

        let nextStepIndex: number;

        switch (target.type) {
        case DecisionBranchTargetType.Continue:
            nextStepIndex = currentStepIndex + 1;
            break;

        case DecisionBranchTargetType.Goto:
            if (!target.stepName) throw new Error('target.stepName is undefined');
            nextStepIndex = this.getStepIndex(target.stepName, flowDefinition);
            break;

        case DecisionBranchTargetType.End:
            nextStepIndex = Number.MAX_SAFE_INTEGER;
            break;

        default:
            if (!target.getErrorMessage) {
                throw new Error(`Unhandled decision value: ${decisionValue}`);                
            } else {
                throw new Error(target.getErrorMessage(decisionValue));                
            }
        }

        return nextStepIndex;
    }

    private getStepIndex(targetStepName: string, flowDefinition: FlowDefinition<TReq, TRes, TState>): number {

        // TODO 07Mar20: Can we have a quicker index lookup?
        const nextStepIndex = flowDefinition.steps.findIndex(step => step.name === targetStepName);

        if (nextStepIndex === -1) throw new Error(`No step could be found with the name: ${targetStepName}`);

        return nextStepIndex;
    }

    private async performActivity(flowContext: FlowContext, stepIndex: number, step: any): Promise<number | undefined> {

        let stepResponse;

        if (step.RequestType === undefined) {

            stepResponse = undefined;

        } else {

            const stepRequest = new step.RequestType();
            step.bindRequest(stepRequest, flowContext.currentStackFrame.state);

            this.debugPreActivityRequest(step.name, stepRequest, flowContext.currentStackFrame.state);

            const mockResponse = flowContext.getMockResponse(step.name, stepRequest);

            stepResponse =
                mockResponse === undefined
                    ? await flowContext.handlers.sendRequest(flowContext, step.RequestType, stepRequest)
                    : mockResponse;

            if (stepResponse === undefined) {
                return undefined;
            }
        }

        step.bindState(stepResponse, flowContext.currentStackFrame.state);

        this.debugPostActivityResponse(step.name, stepResponse, flowContext.currentStackFrame.state);

        return stepIndex + 1;
    }

    private resumeActivity(flowContext: FlowContext, stepIndex: number, step: any): number {

        const stepResponse = flowContext.asyncResponse;

        step.bindState(stepResponse, flowContext.currentStackFrame.state);

        this.debugPostActivityResponse(step.name, stepResponse, flowContext.currentStackFrame.state);

        delete flowContext.asyncResponse;

        return stepIndex + 1;
    }
}

