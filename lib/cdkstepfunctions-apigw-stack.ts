import * as cdk from "@aws-cdk/core";
import * as sfn from "@aws-cdk/aws-stepfunctions";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as iam from "@aws-cdk/aws-iam";
import * as sns from "@aws-cdk/aws-sns";
import * as ssm from "@aws-cdk/aws-ssm";
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";

export class CdkstepfunctionsApigwStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const PREFIX_NAME = id.toLowerCase().replace("stack", "")
    const APIKEY_VALUE = '12345678901234567890' // 20字以上
    
    // state machine
    
    const pass_task = new sfn.Pass(this, "pass_tasks");
    
    const wait_task = new sfn.Wait(this, "wait_task", {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(30)),
    })
    
    const definition = pass_task.next(wait_task)

    const state_machine = new sfn.StateMachine(this, "state_machine", {
      definition,
      timeout: cdk.Duration.seconds(60),
      stateMachineName: PREFIX_NAME + "-statemachine",
    })
    
    // iam role
    
    var role = new iam.Role(this, "role", {
      roleName: PREFIX_NAME + "-role",
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    })
    
    state_machine.grantStartExecution(role)
    
    // api
    
    const aws_integration = new apigateway.AwsIntegration({
      service: 'states',
      action: 'StartExecution',
      options: {
        credentialsRole: role,
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
          'application/json': JSON.stringify({
            stateMachineArn: state_machine.stateMachineArn,
            input: "$util.escapeJavaScript($input.json('$'))"
          })
        },
        integrationResponses: [{
          selectionPattern: '200',
          statusCode: '200',
          responseTemplates: {
            'application/json': "$input.json('$')"
          }
        }]
      }
    })
    
    const api = new apigateway.RestApi(this, 'api', {
      restApiName: PREFIX_NAME + "-api",
    })
    
    api.root.addMethod('GET', aws_integration, {
      apiKeyRequired: true,
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': new apigateway.EmptyModel()
        }
      }]}
    )
    
    // add appkey and plan
    
    const apikey = api.addApiKey('apikey', {
      apiKeyName: PREFIX_NAME + '-apikey', // 削除してくれない?
      value: APIKEY_VALUE, // 20字以上
    })
    
    const plan = api.addUsagePlan('usageplan', {
      name: 'plan',
      apiKey: apikey,
      throttle: {
        rateLimit: 1,
        burstLimit: 1
      },
      quota: {
        limit: 20,
        period: apigateway.Period.DAY
      }
    })
    
    plan.addApiStage({
      stage: api.deploymentStage
    })
    
    new cdk.CfnOutput(this, 'output', {
      value: APIKEY_VALUE
    })
    
    // sns
    
    const ssm_stringvalue = ssm.StringParameter.fromStringParameterName(
      this,
      "ssm_stringvalue",
      "cdksns-general-notify-topic-arn"
    ).stringValue
    
    const topic = sns.Topic.fromTopicArn(this, "topic", ssm_stringvalue)

    const sns_topic_target = new targets.SnsTopic(topic);

    const rule = new events.Rule(this, "rule", {
      eventPattern: {
        source: ["aws.states"],
        detail: {
          status: ["FAILED", "SUCCEEDED", "TIMED_OUT", "RUNNING"],
          stateMachineArn: [state_machine.stateMachineArn],
        },
      },
      ruleName: PREFIX_NAME + "-rule",
      targets: [sns_topic_target],
    });
  }
}
