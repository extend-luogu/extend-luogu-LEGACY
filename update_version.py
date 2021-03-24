#!/bin/env python

import redis

r = redis.Redis(
    host = 'apn1-caring-mollusk-30166.upstash.io',
    port = '30166',
    password = 'ed3f7b629119410a813a81a6c4011106'
)

print('OLD ' + str(r.get('version'), 'utf-8'))
v = input('VER ')
r.set('version', v)

