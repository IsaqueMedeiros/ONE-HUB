# server_hubspot_integrated.py - Servidor Python integrado com HubSpot CLI
import http.server
import socketserver
import os
import json
import subprocess
import threading
import webbrowser
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
import tempfile

PORT = 7037
DIRECTORY = "public"

class HubSpotIntegratedHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # Servir o frontend principal na raiz
        if parsed_path.path == '/' or parsed_path.path == '/index.html':
            self.path = '/journey-board-integrated.html'
        
        # API endpoints integrados com HubSpot CLI
        elif parsed_path.path.startswith('/api/hubspot/'):
            self.handle_hubspot_api(parsed_path)
            return
        
        # Endpoint específico para análise de jornada
        elif parsed_path.path.startswith('/api/journey/'):
            self.handle_journey_integrated_api(parsed_path)
            return
            
        # Endpoint para listar deals
        elif parsed_path.path == '/api/deals':
            self.handle_deals_list()
            return
            
        # Endpoint para listar contacts
        elif parsed_path.path == '/api/contacts':
            self.handle_contacts_list()
            return
        
        # Endpoint para validar CLI
        elif parsed_path.path == '/api/status':
            self.handle_status_check()
            return
        
        # Arquivos estáticos normais
        super().do_GET()
    
    def handle_hubspot_api(self, parsed_path):
        """Handle HubSpot API calls via CLI"""
        try:
            path_parts = parsed_path.path.split('/')
            if len(path_parts) < 4:
                self.send_error_response(400, "Invalid API path")
                return
                
            object_type = path_parts[3]  # deals, contacts, etc
            object_id = path_parts[4] if len(path_parts) > 4 else None
            
            if object_type == 'deals' and object_id:
                data = self.get_deal_via_cli(object_id)
            elif object_type == 'contacts' and object_id:
                data = self.get_contact_via_cli(object_id)
            elif object_type == 'deals' and not object_id:
                data = self.list_deals_via_cli()
            elif object_type == 'contacts' and not object_id:
                data = self.list_contacts_via_cli()
            else:
                self.send_error_response(404, "Endpoint not found")
                return
                
            self.send_json_response(data)
            
        except Exception as e:
            print(f"Erro na API HubSpot: {e}")
            self.send_error_response(500, str(e))
    
    def handle_journey_integrated_api(self, parsed_path):
        """Análise de jornada usando dados reais do HubSpot"""
        try:
            deal_id = parsed_path.path.split('/')[-1]
            query_params = parse_qs(parsed_path.query)
            contact_id = query_params.get('contact_id', [None])[0]
            
            # Buscar dados via CLI
            deal_data = self.get_deal_via_cli(deal_id)
            if not deal_data:
                self.send_error_response(404, f"Deal {deal_id} não encontrado")
                return
            
            # Buscar contact associado se não especificado
            if not contact_id:
                contact_data = self.get_associated_contact_via_cli(deal_id)
            else:
                contact_data = self.get_contact_via_cli(contact_id)
            
            if not contact_data:
                contact_data = {"id": "no-contact", "properties": {}}
            
            # Aplicar análise de jornada
            journey = self.analyze_journey_logic(deal_data, contact_data)
            
            self.send_json_response(journey)
            
        except Exception as e:
            print(f"Erro na análise de jornada: {e}")
            self.send_error_response(500, str(e))
    
    def handle_deals_list(self):
        """Lista todos os deals"""
        try:
            deals = self.list_deals_via_cli(limit=100)
            self.send_json_response(deals)
        except Exception as e:
            self.send_error_response(500, str(e))
    
    def handle_contacts_list(self):
        """Lista todos os contacts"""
        try:
            contacts = self.list_contacts_via_cli(limit=100)
            self.send_json_response(contacts)
        except Exception as e:
            self.send_error_response(500, str(e))
    
    def handle_status_check(self):
        """Verifica status da CLI"""
        try:
            status = self.check_hubspot_cli_status()
            self.send_json_response(status)
        except Exception as e:
            self.send_error_response(500, str(e))
    
    def get_deal_via_cli(self, deal_id):
        """Busca deal específico via HubSpot CLI"""
        try:
            cmd = [
                'hs', 'crm', 'object', 'get',
                '--object-type', 'deals',
                '--object-id', str(deal_id),
                '--properties', 'dealstage,amount,dealname,first_deposit_date,proposal_sent,allocation_done,hs_date_entered_current_stage,closedate',
                '--output', 'json'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
            data = json.loads(result.stdout)
            
            # Normalizar estrutura se necessário
            if isinstance(data, list) and len(data) > 0:
                return data[0]
            return data
            
        except subprocess.CalledProcessError as e:
            print(f"Erro ao buscar deal {deal_id}: {e.stderr}")
            return None
        except subprocess.TimeoutExpired:
            print(f"Timeout ao buscar deal {deal_id}")
            return None
        except json.JSONDecodeError as e:
            print(f"Erro ao decodificar JSON do deal: {e}")
            return None
    
    def get_contact_via_cli(self, contact_id):
        """Busca contact específico via HubSpot CLI"""
        try:
            cmd = [
                'hs', 'crm', 'object', 'get',
                '--object-type', 'contacts',
                '--object-id', str(contact_id),
                '--properties', 'email,firstname,lastname,whatsapp_cadence_active,last_meeting_date,hs_email_open_rate,createdate',
                '--output', 'json'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
            data = json.loads(result.stdout)
            
            if isinstance(data, list) and len(data) > 0:
                return data[0]
            return data
            
        except subprocess.CalledProcessError as e:
            print(f"Erro ao buscar contact {contact_id}: {e.stderr}")
            return None
        except subprocess.TimeoutExpired:
            print(f"Timeout ao buscar contact {contact_id}")
            return None
        except json.JSONDecodeError as e:
            print(f"Erro ao decodificar JSON do contact: {e}")
            return None
    
    def list_deals_via_cli(self, limit=100):
        """Lista deals via HubSpot CLI"""
        try:
            cmd = [
                'hs', 'crm', 'object', 'list',
                '--object-type', 'deals',
                '--properties', 'dealstage,amount,dealname,hs_date_entered_current_stage,closedate',
                '--limit', str(limit),
                '--output', 'json'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=60)
            data = json.loads(result.stdout)
            
            # Retornar apenas os resultados se existirem
            if isinstance(data, dict) and 'results' in data:
                return data['results']
            elif isinstance(data, list):
                return data
            return []
            
        except subprocess.CalledProcessError as e:
            print(f"Erro ao listar deals: {e.stderr}")
            return []
        except subprocess.TimeoutExpired:
            print("Timeout ao listar deals")
            return []
        except json.JSONDecodeError as e:
            print(f"Erro ao decodificar JSON dos deals: {e}")
            return []
    
    def list_contacts_via_cli(self, limit=100):
        """Lista contacts via HubSpot CLI"""
        try:
            cmd = [
                'hs', 'crm', 'object', 'list',
                '--object-type', 'contacts',
                '--properties', 'email,firstname,lastname,hs_email_open_rate,createdate',
                '--limit', str(limit),
                '--output', 'json'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=60)
            data = json.loads(result.stdout)
            
            if isinstance(data, dict) and 'results' in data:
                return data['results']
            elif isinstance(data, list):
                return data
            return []
            
        except subprocess.CalledProcessError as e:
            print(f"Erro ao listar contacts: {e.stderr}")
            return []
        except subprocess.TimeoutExpired:
            print("Timeout ao listar contacts")
            return []
        except json.JSONDecodeError as e:
            print(f"Erro ao decodificar JSON dos contacts: {e}")
            return []
    
    def get_associated_contact_via_cli(self, deal_id):
        """Busca contact associado ao deal via CLI"""
        try:
            # Primeiro, buscar associações
            cmd = [
                'hs', 'crm', 'associations', 'list',
                '--from-object-type', 'deals',
                '--from-object-id', str(deal_id),
                '--to-object-type', 'contacts',
                '--output', 'json'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
            associations = json.loads(result.stdout)
            
            # Se há associações, buscar o primeiro contact
            if isinstance(associations, list) and len(associations) > 0:
                first_association = associations[0]
                contact_id = first_association.get('toObjectId') or first_association.get('id')
                if contact_id:
                    return self.get_contact_via_cli(contact_id)
            elif isinstance(associations, dict) and 'results' in associations:
                results = associations['results']
                if len(results) > 0:
                    contact_id = results[0].get('toObjectId') or results[0].get('id')
                    if contact_id:
                        return self.get_contact_via_cli(contact_id)
            
            return None
            
        except subprocess.CalledProcessError as e:
            print(f"Erro ao buscar associações para deal {deal_id}: {e.stderr}")
            return None
        except subprocess.TimeoutExpired:
            print(f"Timeout ao buscar associações para deal {deal_id}")
            return None
        except json.JSONDecodeError as e:
            print(f"Erro ao decodificar associações: {e}")
            return None
    
    def check_hubspot_cli_status(self):
        """Verifica status da HubSpot CLI"""
        try:
            # Verificar se CLI está instalado
            version_result = subprocess.run(['hs', '--version'], capture_output=True, text=True, timeout=10)
            if version_result.returncode != 0:
                return {"status": "error", "message": "HubSpot CLI não instalado"}
            
            # Verificar se está autenticado
            account_result = subprocess.run(['hs', 'account'], capture_output=True, text=True, timeout=10)
            if account_result.returncode != 0:
                return {"status": "error", "message": "HubSpot CLI não autenticado"}
            
            return {
                "status": "success", 
                "message": "HubSpot CLI conectado",
                "version": version_result.stdout.strip(),
                "account": "Autenticado"
            }
            
        except subprocess.TimeoutExpired:
            return {"status": "error", "message": "Timeout verificando CLI"}
        except Exception as e:
            return {"status": "error", "message": f"Erro: {str(e)}"}
    
    def analyze_journey_logic(self, deal, contact):
        """Aplica a lógica de análise de jornada"""
        journey = {
            "dealId": deal.get("id"),
            "contactId": contact.get("id"),
            "stage": None,
            "substage": None,
            "stageName": None,
            "substageName": None,
            "score": 0,
            "indicators": [],
            "recommendations": [],
            "metadata": {}
        }
        
        # Extrair propriedades
        deal_props = deal.get("properties", {})
        contact_props = contact.get("properties", {})
        
        deal_stage = deal_props.get("dealstage")
        first_deposit_date = deal_props.get("first_deposit_date")
        proposal_sent = deal_props.get("proposal_sent")
        allocation_done = deal_props.get("allocation_done")
        whatsapp_cadence_active = contact_props.get("whatsapp_cadence_active")
        last_meeting_date = contact_props.get("last_meeting_date")
        
        # Aplicar regras conforme documento
        
        # Regra 1: Prospecção
        if deal_stage in ['appointmentscheduled', 'presentationscheduled']:
            journey["stage"] = "PROSPECTING"
            journey["stageName"] = "Prospecção"
            
            if proposal_sent in ['true', True]:
                journey["substage"] = "PROPOSAL_SENT"
                journey["substageName"] = "Proposta Enviada"
            else:
                journey["substage"] = "INITIAL_CONTACT"
                journey["substageName"] = "Contato Inicial"
        
        # Regra 2: Onboarding
        if deal_stage in ['contractsent', 'closedwon'] and first_deposit_date:
            journey["stage"] = "ONBOARDING"
            journey["stageName"] = "Onboarding"
            
            if allocation_done in ['true', True]:
                journey["substage"] = "IMPLEMENTATION"
                journey["substageName"] = "Implementação"
            else:
                journey["substage"] = "CONTRACT_SIGNED"
                journey["substageName"] = "Contrato Assinado"
        
        # Regra 3: Relacionamento
        if whatsapp_cadence_active in ['true', True]:
            days_since_meeting = self.calculate_days_since(last_meeting_date)
            if days_since_meeting <= 90:
                journey["stage"] = "RELATIONSHIP"
                journey["stageName"] = "Relacionamento"
                journey["substage"] = "ACTIVE_CLIENT"
                journey["substageName"] = "Cliente Ativo"
        
        # Calcular score e metadados
        journey["score"] = self.calculate_score(journey, deal_props, contact_props)
        journey["indicators"] = self.generate_indicators(deal_props, contact_props)
        journey["recommendations"] = self.generate_recommendations(journey)
        journey["metadata"] = {
            "analyzedAt": datetime.now().isoformat(),
            "daysInCurrentStage": self.calculate_days_since(deal_props.get("hs_date_entered_current_stage")),
            "dealAmount": float(deal_props.get("amount", 0) or 0),
            "contactName": f"{contact_props.get('firstname', '')} {contact_props.get('lastname', '')}".strip(),
            "contactEmail": contact_props.get("email", "")
        }
        
        return journey
    
    def calculate_days_since(self, date_string):
        """Calcula dias desde uma data"""
        if not date_string:
            return 0
        try:
            # Tentar formatos diferentes
            if 'T' in date_string:
                date = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
            else:
                date = datetime.strptime(date_string, '%Y-%m-%d')
                
            now = datetime.now(date.tzinfo) if date.tzinfo else datetime.now()
            return (now - date).days
        except:
            return 0
    
    def calculate_score(self, journey, deal_props, contact_props):
        """Calcula score da jornada"""
        score = 0
        
        if journey["stage"] == "PROSPECTING":
            score = 20
            if journey["substage"] == "PROPOSAL_SENT":
                score += 15
        elif journey["stage"] == "ONBOARDING":
            score = 50
            if journey["substage"] == "IMPLEMENTATION":
                score += 20
        elif journey["stage"] == "RELATIONSHIP":
            score = 80
        else:
            score = 10
        
        # Bônus por valor
        amount = float(deal_props.get("amount", 0) or 0)
        if amount > 50000:
            score += 10
        if amount > 100000:
            score += 10
        
        return min(score, 100)
    
    def generate_indicators(self, deal_props, contact_props):
        """Gera indicadores"""
        indicators = []
        
        amount = float(deal_props.get("amount", 0) or 0)
        if amount > 50000:
            indicators.append("Alto valor")
        
        email_open_rate = float(contact_props.get("hs_email_open_rate", 0) or 0)
        if email_open_rate > 0.3:
            indicators.append("Alto engajamento")
        
        if deal_props.get("dealstage") == "closedwon":
            indicators.append("Cliente conquistado")
        
        return indicators
    
    def generate_recommendations(self, journey):
        """Gera recomendações"""
        recommendations = []
        
        if journey["stage"] == "PROSPECTING":
            recommendations.extend([
                "Agendar próxima reunião",
                "Enviar material complementar",
                "Qualificar necessidades específicas"
            ])
        elif journey["stage"] == "ONBOARDING":
            recommendations.extend([
                "Acompanhar implementação",
                "Agendar treinamento",
                "Definir marcos de sucesso"
            ])
        elif journey["stage"] == "RELATIONSHIP":
            recommendations.extend([
                "Avaliar oportunidades de upsell",
                "Solicitar feedback",
                "Programar revisão trimestral"
            ])
        else:
            recommendations.extend([
                "Definir próximos passos",
                "Agendar follow-up"
            ])
        
        return recommendations
    
    def send_json_response(self, data):
        """Envia resposta JSON"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8'))
    
    def send_error_response(self, status_code, message):
        """Envia resposta de erro"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        error_response = {"error": message, "timestamp": datetime.now().isoformat()}
        self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Log personalizado"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")

def check_hubspot_cli():
    """Verifica se HubSpot CLI está instalado e autenticado"""
    try:
        # Verificar se CLI está instalado
        subprocess.run(['hs', '--version'], capture_output=True, check=True, timeout=10)
        print("✅ HubSpot CLI encontrado")
        
        # Verificar se está autenticado
        result = subprocess.run(['hs', 'account'], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("✅ HubSpot CLI autenticado")
            return True
        else:
            print("❌ HubSpot CLI não autenticado. Execute: hs auth")
            return False
            
    except subprocess.CalledProcessError:
        print("❌ HubSpot CLI não encontrado. Instale com: npm install -g @hubspot/cli")
        return False
    except subprocess.TimeoutExpired:
        print("❌ Timeout verificando HubSpot CLI")
        return False
    except FileNotFoundError:
        print("❌ HubSpot CLI não encontrado. Instale com: npm install -g @hubspot/cli")
        return False

def create_directory_structure():
    """Cria estrutura de pastas"""
    if not os.path.exists(DIRECTORY):
        os.makedirs(DIRECTORY)
        print(f"✅ Criada pasta '{DIRECTORY}'")
    return os.path.exists(os.path.join(DIRECTORY, "journey-board-integrated.html"))

def start_server():
    """Inicia o servidor integrado"""
    print("\n" + "="*70)
    print("🚀 JOURNEY BOARD - INTEGRADO COM HUBSPOT CLI")
    print("="*70)
    
    # Verificar HubSpot CLI
    if not check_hubspot_cli():
        print("\n❌ Falha na verificação do HubSpot CLI")
        print("Execute os seguintes comandos:")
        print("1. npm install -g @hubspot/cli")
        print("2. hs auth")
        print("3. hs account  # para verificar")
        return
    
    has_html = create_directory_structure()
    
    with socketserver.TCPServer(("", PORT), HubSpotIntegratedHandler) as httpd:
        print(f"📍 URL Principal: http://localhost:{PORT}")
        print(f"📍 API Status: http://localhost:{PORT}/api/status")
        print(f"📍 API Deals: http://localhost:{PORT}/api/deals")
        print(f"📍 API Contacts: http://localhost:{PORT}/api/contacts")
        print(f"📍 API Journey: http://localhost:{PORT}/api/journey/DEAL_ID")
        print(f"📂 Pasta: {DIRECTORY}/")
        print("="*70)
        print("ℹ️  Para parar: Ctrl+C")
        print("ℹ️  Dados vem direto do HubSpot via CLI autenticada")
        print("="*70)
        
        # Abrir navegador automaticamente
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