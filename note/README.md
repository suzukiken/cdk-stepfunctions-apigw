+++
title = "state machineをApi Gatewayから実行する"
date = "2021-04-11"
tags = ["Step Functions", "Api Gateway"]
+++

Api GatewayからStep Functionsのステートマシーンを実行する仕組み。

このサンプルコードではApi GatewayへのリクエストにはApikeyを必須にしている。Api Gatewayへのhttpリクエストは成功するが、ステートマシーンの実行の成功、失敗はそれとは関係がない。

[CDKのコード](https://github.com/suzukiken/cdkstepfunctions-apigw)

