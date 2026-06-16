import os
import time
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_EXPIRY = 300  # 5 minutes cache
cache = {
    "data": None,
    "last_fetched": 0
}

def clean_text(html_content):
    """Extract clean text from HTML content for Tweet composing."""
    soup = BeautifulSoup(html_content, 'html.parser')
    return soup.get_text().strip()

def parse_release_notes(xml_content):
    """Parse the Atom XML feed and extract structured release notes."""
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        raise ValueError(f"Failed to parse XML: {str(e)}")
    
    # Atom XML namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    feed_title = root.find('atom:title', ns)
    feed_title_text = feed_title.text if feed_title is not None else "BigQuery Release Notes"
    
    feed_updated = root.find('atom:updated', ns)
    feed_updated_text = feed_updated.text if feed_updated is not None else ""
    
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        title_el = entry.find('atom:title', ns)
        date_str = title_el.text if title_el is not None else "Unknown Date"
        
        updated_el = entry.find('atom:updated', ns)
        date_iso = updated_el.text if updated_el is not None else ""
        
        id_el = entry.find('atom:id', ns)
        entry_id = id_el.text if id_el is not None else ""
        
        link_el = entry.find("atom:link[@rel='alternate']", ns)
        if link_el is None:
            link_el = entry.find("atom:link", ns)
        link = link_el.attrib.get('href', '') if link_el is not None else ''
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ''
        
        soup = BeautifulSoup(content_html, 'html.parser')
        
        updates = []
        headings = soup.find_all('h3')
        
        if not headings:
            text_content = soup.get_text().strip()
            if text_content:
                updates.append({
                    "type": "General",
                    "content_html": content_html,
                    "content_text": text_content
                })
        else:
            for h3 in headings:
                update_type = h3.get_text().strip()
                
                sibling_html = []
                sibling = h3.next_sibling
                while sibling and sibling.name != 'h3':
                    if sibling.name:
                        sibling_html.append(str(sibling))
                    elif sibling.strip():
                        sibling_html.append(f"<p>{sibling.strip()}</p>")
                    sibling = sibling.next_sibling
                
                full_html = "".join(sibling_html)
                text_content = clean_text(full_html)
                
                updates.append({
                    "type": update_type,
                    "content_html": full_html,
                    "content_text": text_content
                })
        
        entries.append({
            "id": entry_id,
            "date_str": date_str,
            "date_iso": date_iso,
            "link": link,
            "updates": updates
        })
        
    return {
        "title": feed_title_text,
        "updated": feed_updated_text,
        "entries": entries
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    if not force_refresh and cache["data"] and (now - cache["last_fetched"] < CACHE_EXPIRY):
        return jsonify({
            "status": "success",
            "source": "cache",
            "data": cache["data"]
        })
        
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        parsed_data = parse_release_notes(response.content)
        
        cache["data"] = parsed_data
        cache["last_fetched"] = now
        
        return jsonify({
            "status": "success",
            "source": "network",
            "data": parsed_data
        })
        
    except requests.exceptions.RequestException as e:
        if cache["data"]:
            return jsonify({
                "status": "partial_success",
                "source": "stale_cache",
                "error": str(e),
                "data": cache["data"]
            })
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch release notes: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"An error occurred: {str(e)}"
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
