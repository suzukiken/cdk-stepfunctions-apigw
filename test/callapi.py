import urllib.request
import sys

url = sys.argv[1]
apikey = sys.argv[2]

req = urllib.request.Request(url)
req.add_header('x-api-key', apikey)

res = urllib.request.urlopen(req)

print(res.read().decode('utf-8'))

