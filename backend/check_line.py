content = open('main.py', 'r', encoding='utf-8').read() 
lines = content.split('\n') 
[print(i+296, repr(l)) for i, l in enumerate(lines[295:305])] 
