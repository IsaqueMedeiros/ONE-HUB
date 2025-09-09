# server.py - Servidor Python para o Frontend Journey Board
import http.server
import socketserver
import os
import json
from urllib.parse import urlparse, parse_qs
import threading
import webbrowser
from datetime import datetime

PORT = 7036
DIRECTORY = "public"

class JourneyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # Servir o frontend principal na raiz
        if parsed_path.path == '/' or parsed_path.path == '/index.html':
            self.path = '/journey-board.html'
        
        # API endpoint mock para teste
        elif parsed_path.path.startswith('/api/journey/'):
            self.handle_journey_api(parsed_path)
            return
        
        # Arquivos estáticos normais
        super().do_GET()
    
    def handle_journey_api(self, parsed_path):
        """Simula endpoint GET /api/journey/:id"""
        deal_id = parsed_path.path.split('/')[-1]
        
        # Dados mock conforme documento
        mock_response = {
            "dealId": deal_id,
            "contactId": f"contact-{deal_id}",
            "stage": "PROSPECTING",
            "substage": "PROPOSAL_SENT", 
            "stageName": "Prospecção",
            "substageName": "Proposta Enviada",
            "score": 72,
            "indicators": [
                "Alto valor de deal",
                "Engajamento ativo",
                "Resposta rápida aos emails"
            ],
            "recommendations": [
                "Agendar reunião de fechamento",
                "Enviar case de sucesso similar",
                "Preparar contrato personalizado"
            ],
            "metadata": {
                "analyzedAt": datetime.now().isoformat(),
                "daysInCurrentStage": 5,
                "dealAmount": 67500,
                "contactName": "Maria Silva",
                "contactEmail": "maria.silva@empresa.com"
            },
            "endpoint": {
                "method": "GET",
                "path": f"/api/journey/{deal_id}",
                "timestamp": datetime.now().isoformat()
            }
        }
        
        # Enviar resposta JSON
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(mock_response, indent=2).encode())
    
    def log_message(self, format, *args):
        """Log personalizado"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")

def create_directory_structure():
    """Cria estrutura de pastas se não existir"""
    if not os.path.exists(DIRECTORY):
        os.makedirs(DIRECTORY)
        print(f"✅ Criada pasta '{DIRECTORY}'")

def start_server():
    """Inicia o servidor HTTP"""
    has_html = create_directory_structure()
    
    with socketserver.TCPServer(("", PORT), JourneyHandler) as httpd:
        print("\n" + "="*60)
        print("🚀 SERVIDOR JOURNEY BOARD INICIADO")
        print("="*60)
        print(f"📍 URL Principal: http://localhost:{PORT}")
        print(f"📍 API Mock: http://localhost:{PORT}/api/journey/123")
        print(f"📂 Pasta: {DIRECTORY}/")
        if not has_html:
            print("⚠️  ATENÇÃO: Arquivo HTML não encontrado!")
        print("="*60)
        print("ℹ️  Para parar: Ctrl+C")
        print("ℹ️  HubSpot continua em: http://hslocal.net:5173")
        print("="*60)
        
        # Abrir navegador automaticamente apenas se tiver HTML
        if has_html:
            def open_browser():
                import time
                time.sleep(2)
                webbrowser.open(f'http://localhost:{PORT}')
            
            threading.Thread(target=open_browser, daemon=True).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Servidor parado")

if __name__ == "__main__":
    start_server()