"""Query Wikimedia Commons API for imageinfo of given titles."""
import json, sys, urllib.request, urllib.parse

UA = {"User-Agent": "qingye-blog-asset-prep/1.0 (Mozilla/5.0; Windows NT 10.0; Win64; x64) Chrome/120.0"}

def api(params):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def info(title, width=None):
    params = {
        "action": "query", "format": "json",
        "prop": "imageinfo", "iiprop": "url|size",
        "titles": title,
    }
    if width:
        params["iiurlwidth"] = str(width)
    d = api(params)
    p = next(iter(d["query"]["pages"].values()))
    if "imageinfo" not in p:
        print("MISSING:", title)
        return
    ii = p["imageinfo"][0]
    print(f"== {title}")
    print(f"   {ii['width']} x {ii['height']}")
    if "thumburl" in ii:
        print("   thumb:", ii["thumburl"])
    print("   orig :", ii["url"])
    print("   page :", ii["descriptionurl"])

if __name__ == "__main__":
    titles = sys.argv[1:]
    width = None
    if titles and titles[0].startswith("--width="):
        width = int(titles[0].split("=")[1])
        titles = titles[1:]
    for t in titles:
        info(t, width)
