<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Fault Isolation Data Module
     
     Contains templates for processing fault isolation data modules
     (fault.xsd based modules).
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- ==================================================================== -->
  <!--                    FAULT DMODULE TEMPLATE                             -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[contains(@xsi:noNamespaceSchemaLocation, 'fault.xsd')]">
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="content">
        <fo:block>
          <!-- Generate markers for headers/footers -->
          <xsl:call-template name="generate-markers"/>
          <!-- Process the content -->
          <fo:block id="content-start-{generate-id()}" padding-bottom="20mm">
            <xsl:apply-templates select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
            <xsl:apply-templates select="content"/>
          </fo:block>
          <!-- End of data module marker -->
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    FAULT REPORTING CONTENT                            -->
  <!-- ==================================================================== -->
  <xsl:template match="faultReporting">
    <fo:block id="{generate-id()}">
      <xsl:if test="$show.schema.heading != 0">
        <fo:block xsl:use-attribute-sets="centerhead2">Fault Reporting</fo:block>
      </xsl:if>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    FAULT ISOLATION PROCEDURE                          -->
  <!-- ==================================================================== -->
  <xsl:template match="faultIsolation">
    <fo:block id="{generate-id()}">
      <xsl:if test="$show.schema.heading != 0">
        <fo:block xsl:use-attribute-sets="centerhead2">Fault Isolation</fo:block>
      </xsl:if>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="faultIsolationProcedure">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ISOLATION PROCEDURE                                -->
  <!-- ==================================================================== -->
  <xsl:template match="isolationProcedure">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <xsl:apply-templates select="preliminaryRqmts"/>
      <xsl:apply-templates select="isolationMainProcedure"/>
      <xsl:apply-templates select="closeRqmts"/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ISOLATION MAIN PROCEDURE                           -->
  <!-- ==================================================================== -->
  <xsl:template match="isolationMainProcedure">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <fo:block xsl:use-attribute-sets="sidehead0">Fault Isolation Procedure</fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    FAULT ELEMENTS                                     -->
  <!-- ==================================================================== -->
  <xsl:template match="fault">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="faultDescr">
    <fo:block font-weight="bold" padding-top="5pt">
      <xsl:text>Fault: </xsl:text>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="faultCode">
    <fo:inline font-family="{$monospace-stack}">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="faultCodeDescr">
    <fo:block padding-top="3pt">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ISOLATED FAULT                                     -->
  <!-- ==================================================================== -->
  <xsl:template match="isolatedFault">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}" 
        border="0.5pt solid black" padding="5mm" background-color="#f5f5f5">
      <fo:block font-weight="bold">Isolated Fault:</fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="isolatedFaultDescr">
    <fo:block padding-top="3pt">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    CORRECTIVE ACTION                                  -->
  <!-- ==================================================================== -->
  <xsl:template match="correctiveAction">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <fo:block font-weight="bold" color="{$color-blue}">Corrective Action:</fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="correctiveActionDescr">
    <fo:block padding-top="3pt">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    LABELLED PARA TEMPLATE                             -->
  <!-- ==================================================================== -->
  <!-- New FO-specific template for labelled paragraphs (from fault-pdf.xsl) -->
  <xsl:template name="labelled.para.fo">
    <xsl:param name="label"/>
    <xsl:param name="content"/>
    <fo:block padding-top="{$standard-leading}">
      <fo:list-block provisional-distance-between-starts="{$inner-type-limit}">
        <fo:list-item>
          <fo:list-item-label end-indent="label-end()">
            <fo:block>
              <xsl:value-of select="$label"/>
            </fo:block>
          </fo:list-item-label>
          <fo:list-item-body start-indent="body-start()">
            <fo:block>
              <xsl:copy-of select="$content"/>
            </fo:block>
          </fo:list-item-body>
        </fo:list-item>
      </fo:list-block>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ISOLATION ITEM NUMBERING                           -->
  <!-- ==================================================================== -->
  <!-- Sequential numbering for all isolation items (from fault-pdf.xsl) -->
  <xsl:template name="isolation.item.number">
    <xsl:number count="action|
                       isolationStepQuestion|
                       isolationProcedureEnd[not(action)]|
                       closeRqmts/reqCondGroup/reqCondNoRef|
                       closeRqmts/reqCondGroup/reqCondDm|
                       closeRqmts/reqCondGroup/reqCondPm|
                       closeRqmts/reqCondGroup/reqCondExternalPub"
                from="isolationProcedure" level="any"/>
  </xsl:template>
  <!-- Mode templates for getting step numbers for cross-references -->
  <xsl:template match="*" mode="iso.item.num">
    <xsl:call-template name="isolation.item.number"/>
  </xsl:template>
  <xsl:template match="isolationStep" mode="iso.item.num">
    <xsl:apply-templates select="(action|isolationStepQuestion)[1]" mode="iso.item.num"/>
  </xsl:template>
  <xsl:template match="isolationProcedureEnd" mode="iso.item.num">
    <xsl:choose>
      <xsl:when test="action">
        <xsl:apply-templates select="action[1]" mode="iso.item.num"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="isolation.item.number"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ISOLATION STEP                                     -->
  <!-- ==================================================================== -->
  <xsl:template match="isolationStep">
    <fo:block keep-with-next="always" id="{generate-id()}">
      <xsl:apply-templates select="@warningRefs"/>
      <xsl:apply-templates select="@cautionRefs"/>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ISOLATION STEP QUESTION/ANSWER                     -->
  <!-- ==================================================================== -->
  <xsl:template match="isolationStepQuestion">
    <xsl:param name="prefix"/>
    <xsl:call-template name="labelled.para.fo">
      <xsl:with-param name="label">
        <xsl:value-of select="$prefix"/>
        <xsl:call-template name="isolation.item.number"/>
      </xsl:with-param>
      <xsl:with-param name="content">
        <xsl:apply-templates/>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>
  <xsl:template match="isolationStepAnswer">
    <xsl:param name="prefix"/>
    <xsl:apply-templates/>
  </xsl:template>
  <xsl:template match="yesNoAnswer">
    <fo:block id="{generate-id()}">
      <xsl:apply-templates>
        <xsl:with-param name="prefix">
          <xsl:call-template name="isolation.item.number"/>
          <xsl:text>.</xsl:text>
        </xsl:with-param>
      </xsl:apply-templates>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ISOLATION PROCEDURE QUESTION                       -->
  <!-- ==================================================================== -->
  <!-- Template for YES/NO answer formatting with Go to Step X links -->
  <xsl:template name="isolation.procedure.question">
    <xsl:param name="number"/>
    <xsl:param name="question"/>
    <xsl:variable name="next.action.ref.id" select="@nextActionRefId"/>
    <xsl:variable name="next.elem" select="ancestor-or-self::dmodule//*[@id = $next.action.ref.id]"/>
    <xsl:call-template name="labelled.para.fo">
      <xsl:with-param name="label">
        <xsl:value-of select="$number"/>
      </xsl:with-param>
      <xsl:with-param name="content">
        <fo:inline>
          <xsl:value-of select="$question"/>
          <xsl:text>: </xsl:text>
          <xsl:choose>
            <xsl:when test="name($next.elem) = 'closeRqmts'">
              <fo:inline font-weight="bold">Go to Requirements after job completion.</fo:inline>
            </xsl:when>
            <xsl:when test="$next.elem">
              <xsl:text>Go to </xsl:text>
              <fo:basic-link color="{$color-link}" text-decoration="underline">
                <xsl:attribute name="internal-destination">
                  <xsl:value-of select="generate-id($next.elem)"/>
                </xsl:attribute>
                <xsl:text>Step </xsl:text>
                <xsl:apply-templates select="$next.elem" mode="iso.item.num"/>
              </fo:basic-link>
              <xsl:text>.</xsl:text>
            </xsl:when>
            <xsl:otherwise>
              <xsl:apply-templates/>
            </xsl:otherwise>
          </xsl:choose>
        </fo:inline>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>
  <xsl:template match="yesAnswer">
    <xsl:param name="prefix"/>
    <xsl:call-template name="isolation.procedure.question">
      <xsl:with-param name="number">
        <xsl:value-of select="$prefix"/>1
      </xsl:with-param>
      <xsl:with-param name="question">Yes</xsl:with-param>
    </xsl:call-template>
  </xsl:template>
  <xsl:template match="noAnswer">
    <xsl:param name="prefix"/>
    <xsl:call-template name="isolation.procedure.question">
      <xsl:with-param name="number">
        <xsl:value-of select="$prefix"/>2
      </xsl:with-param>
      <xsl:with-param name="question">No</xsl:with-param>
    </xsl:call-template>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    LIST OF CHOICES                                    -->
  <!-- ==================================================================== -->
  <xsl:template match="listOfChoices">
    <fo:block id="{generate-id()}">
      <xsl:apply-templates>
        <xsl:with-param name="prefix">
          <xsl:call-template name="isolation.item.number"/>
          <xsl:text>.</xsl:text>
        </xsl:with-param>
      </xsl:apply-templates>
    </fo:block>
  </xsl:template>
  <xsl:template match="choice">
    <xsl:param name="prefix"/>
    <xsl:call-template name="isolation.procedure.question">
      <xsl:with-param name="number">
        <xsl:value-of select="$prefix"/>
        <xsl:number/>
      </xsl:with-param>
      <xsl:with-param name="question">
        <xsl:apply-templates select="text()"/>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ACTION                                             -->
  <!-- ==================================================================== -->
  <xsl:template match="action">
    <xsl:param name="prefix"/>
    <xsl:call-template name="labelled.para.fo">
      <xsl:with-param name="label">
        <xsl:value-of select="$prefix"/>
        <xsl:call-template name="isolation.item.number"/>
      </xsl:with-param>
      <xsl:with-param name="content">
        <xsl:apply-templates/>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    OBSERVATION                                        -->
  <!-- ==================================================================== -->
  <xsl:template match="observation">
    <fo:block padding-top="3pt" font-style="italic">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    PROBABILITY                                        -->
  <!-- ==================================================================== -->
  <xsl:template match="faultProbability">
    <fo:inline>
      <xsl:text>(</xsl:text>
      <xsl:value-of select="@faultProbabilityValue"/>
      <xsl:text>% probability)</xsl:text>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    SYMPTOMS                                           -->
  <!-- ==================================================================== -->
  <xsl:template match="symptom">
    <fo:block padding-top="3pt">
      <fo:inline font-weight="bold">Symptom: </fo:inline>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="symptomDescr">
    <xsl:apply-templates/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    FOLLOW-ON MAINTENANCE                              -->
  <!-- ==================================================================== -->
  <xsl:template match="followOnMaintenance">
    <fo:block padding-top="{$standard-leading}" border-top="0.5pt solid black" margin-top="10pt">
      <fo:block font-weight="bold">Follow-on Maintenance:</fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ISOLATION PROCEDURE END                            -->
  <!-- ==================================================================== -->
  <xsl:template match="isolationProcedureEnd">
    <xsl:param name="prefix"/>
    <fo:block id="{generate-id()}">
      <xsl:choose>
        <xsl:when test="action">
          <fo:block keep-with-next="always">
            <xsl:apply-templates/>
          </fo:block>
          <fo:block padding-top="{$standard-leading}" start-indent="{$inner-type-limit}">
            <fo:inline font-weight="bold">Go to Requirements after job completion.</fo:inline>
          </fo:block>
        </xsl:when>
        <xsl:otherwise>
          <xsl:call-template name="labelled.para.fo">
            <xsl:with-param name="label">
              <xsl:value-of select="$prefix"/>
              <xsl:call-template name="isolation.item.number"/>
            </xsl:with-param>
            <xsl:with-param name="content">
              <xsl:choose>
                <xsl:when test="*">
                  <xsl:apply-templates select="*|processing-instruction('page-break')"/>
                  <fo:block padding-top="{$standard-leading}">
                    <fo:inline font-weight="bold">Go to Requirements after job completion.</fo:inline>
                  </fo:block>
                </xsl:when>
                <xsl:otherwise>
                  <fo:inline font-weight="bold">Go to Requirements after job completion.</fo:inline>
                </xsl:otherwise>
              </xsl:choose>
            </xsl:with-param>
          </xsl:call-template>
        </xsl:otherwise>
      </xsl:choose>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    TEST EQUIPMENT                                     -->
  <!-- ==================================================================== -->
  <xsl:template match="testEquip">
    <fo:block padding-top="3pt">
      <fo:inline font-weight="bold">Test Equipment: </fo:inline>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    CIRCUIT BREAKER                                    -->
  <!-- ==================================================================== -->
  <xsl:template match="circuitBreakerRef">
    <fo:inline font-family="{$monospace-stack}">
      <xsl:text>CB </xsl:text>
      <xsl:value-of select="@circuitBreakerNumber"/>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    FLOW CHART RELATED                                 -->
  <!-- ==================================================================== -->
  <xsl:template match="faultIsolationFlowChart">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <xsl:if test="$show.schema.heading != 0">
        <fo:block xsl:use-attribute-sets="centerhead2">Fault Isolation Flow Chart</fo:block>
      </xsl:if>
      <fo:block text-align="center">
        <xsl:apply-templates/>
      </fo:block>
    </fo:block>
  </xsl:template>
  <xsl:template match="fcDecision">
    <fo:block padding="5mm" border="1pt solid black" background-color="#ffffd0" 
        margin="3mm" display-align="center">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="fcAction">
    <fo:block padding="5mm" border="1pt solid black" background-color="#d0ffd0" 
        margin="3mm" display-align="center">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="fcTerminal">
    <fo:block padding="5mm" border="1pt solid black" background-color="#d0d0ff" 
        margin="3mm" display-align="center" font-weight="bold">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="fcConnector">
    <fo:block padding="3mm" text-align="center">
      <fo:inline font-size="16pt">&#x2193;</fo:inline>
    </fo:block>
  </xsl:template>
</xsl:stylesheet>