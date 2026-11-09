# 独立实现 DouZero 编码器（按 env.py 规格重写，不 import douzero），产出黄金向量
import json
import numpy as np
from collections import Counter

Card2Column = {3:0,4:1,5:2,6:3,7:4,8:5,9:6,10:7,11:8,12:9,13:10,14:11,17:12}
NumOnes2Array = {0:[0,0,0,0],1:[1,0,0,0],2:[1,1,0,0],3:[1,1,1,0],4:[1,1,1,1]}

def cards2array(cards):
    if len(cards) == 0:
        return np.zeros(54, dtype=np.float32)
    matrix = np.zeros([4,13], dtype=np.float32)
    jokers = np.zeros(2, dtype=np.float32)
    for card, n in Counter(cards).items():
        if card < 20:
            matrix[:, Card2Column[card]] = NumOnes2Array[n]
        elif card == 20: jokers[0] = 1
        elif card == 30: jokers[1] = 1
    return np.concatenate((matrix.flatten('F'), jokers))

def one_hot(v, m):
    a = np.zeros(m, dtype=np.float32); a[v-1] = 1; return a

def z_of(seq):
    seq = seq[-15:]
    if len(seq) < 15: seq = [[] for _ in range(15-len(seq))] + seq
    arr = np.zeros((15,54), dtype=np.float32)
    for i,c in enumerate(seq): arr[i,:] = cards2array(c)
    return arr.reshape(5,162)

# 手牌（DouZero 牌值）
hands = [
    [3,3,4,17,20,30],
    [5,6,7,8,9,10,11,12,13,14,17,17],
    [20,30],
    [3,3,3,3,17,17,17,17],
    [10,10,11,11,12,12,13,13,14,14],
]
out = {"cards": [cards2array(h).tolist() for h in hands]}

# 一个完整的 landlord 局面
seq = [[3,3],[17,17],[],[4,5,6,7,8],[]]
my = [3,3,4,5,6,7,8,9,9,10,10,11,11,12,12,13,13]
other = [14,14,17,17,17,20,30]
up_played = [3,3,4]
down_played = [17,17]
last = [4,5,6,7,8]
x_no_action = np.concatenate((
    cards2array(my), cards2array(other), cards2array(last),
    cards2array(up_played), cards2array(down_played),
    one_hot(10,17), one_hot(12,17), (lambda b: (lambda a: (a.__setitem__(b,1), a)[1])(np.zeros(15,dtype=np.float32)))(2)
))
out["landlord"] = {"x_no_action": x_no_action.tolist(), "z": z_of(seq).tolist()}

# 一个完整 landlord_up 局面
my2 = [3,4,5,5,6,7,9,9,10,11,12,12,13,14,14,20,30]
other2 = [3,3,4,4,5,6,7,8,8,9,10,11,13,13,17,17,17]
landlord_played = [17,17,14]
teammate_played = [3,3,4]
last2 = [5,6,7,8,9]
last_landlord = [17,17]
last_teammate = [3,3,4]
x2 = np.concatenate((
    cards2array(my2), cards2array(other2), cards2array(landlord_played),
    cards2array(teammate_played), cards2array(last2), cards2array(last_landlord),
    cards2array(last_teammate), one_hot(15,20), one_hot(14,17),
    (lambda b: (lambda a: (a.__setitem__(b,1), a)[1])(np.zeros(15,dtype=np.float32)))(1)
))
out["landlord_up"] = {"x_no_action": x2.tolist(), "z": z_of(seq).tolist()}
out["seq"] = seq
json.dump(out, open("golden-encoder.json","w"), ensure_ascii=False)
print("dims", len(out["cards"]), len(x_no_action), len(x2))
