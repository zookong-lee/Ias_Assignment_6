
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

export class CorpwebCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Parameters
    const instanceTypeParam = new cdk.CfnParameter(this, 'InstanceType', {
      type: 'String',
      allowedValues: ['t2.micro', 't2.small'],
      description: 'EC2 instance type',
    });

    const keyPairParam = new cdk.CfnParameter(this, 'KeyPair', {
      type: 'AWS::EC2::KeyPair::KeyName',
      description: 'Key pair for EC2 instances',
    });

    const yourIpParam = new cdk.CfnParameter(this, 'YourIp', {
      type: 'String',
      description: 'Your public IP address in CIDR notation',
    });

    // VPC
    const vpc = new ec2.Vpc(this, 'EngineeringVpc', {
      cidr: '10.0.0.0/18',
      maxAzs: 2, // Default is all AZs in region
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet1',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PublicSubnet2',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // Security Group
    const webserversSG = new ec2.SecurityGroup(this, 'WebserversSG', {
      vpc,
      description: 'Allow HTTP and SSH access',
      allowAllOutbound: true,
    });

    webserversSG.addIngressRule(ec2.Peer.ipv4(yourIpParam.valueAsString), ec2.Port.tcp(22), 'Allow SSH access from my IP');
    webserversSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP access from anywhere');

    // EC2 Instances
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'yum update -y',
      'yum install -y git httpd php',
      'service httpd start',
      'chkconfig httpd on',
      'aws s3 cp s3://seis665-public/index.php /var/www/html/'
    );

    const instance1 = new ec2.Instance(this, 'web1', {
      vpc,
      instanceType: new ec2.InstanceType(instanceTypeParam.valueAsString),
      machineImage: ec2.MachineImage.genericLinux({
        'us-east-1': 'ami-01cc34ab2709337aa', // Change to your region
      }),
      keyName: keyPairParam.valueAsString,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: webserversSG,
      userData,
    });

    const instance2 = new ec2.Instance(this, 'web2', {
      vpc,
      instanceType: new ec2.InstanceType(instanceTypeParam.valueAsString),
      machineImage: ec2.MachineImage.genericLinux({
        'us-east-1': 'ami-01cc34ab2709337aa', // Change to your region
      }),
      keyName: keyPairParam.valueAsString,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: webserversSG,
      userData,
    });

    // Load Balancer
    const lb = new elbv2.ApplicationLoad