<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Table of Contents Module
     
     Contains templates for per-DM TOC, List of Figures, and List of Tables.
     Each data module generates its own TOC/LOF/LOT section.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

  <!-- ==================================================================== -->
  <!--                    TABLE OF CONTENTS (per DM)                        -->
  <!-- ==================================================================== -->
  <xsl:template name="table-of-contents">
    <xsl:param name="scope" select="ancestor-or-self::dmodule"/>
    <!-- Only generate if there is actual content to list -->
    <xsl:variable name="has-description" select="$scope/content/description"/>
    <xsl:variable name="has-procedure" select="$scope/content/procedure"/>
    <xsl:variable name="has-fault" select="$scope/content/faultIsolation"/>
    <xsl:variable name="has-crew" select="$scope/content/crew"/>
    <xsl:variable name="has-refs" select="$scope/content/refs"/>
    <xsl:if test="$has-description or $has-procedure or $has-fault or $has-crew or $has-refs">
      <fo:block font-family="{$font-stack}" id="toc-{generate-id($scope)}" space-after="16pt">
        <!-- TOC Title with "Page" header -->
        <fo:block space-after="4pt">
          <fo:table table-layout="fixed" width="100%">
            <fo:table-column column-width="proportional-column-width(1)"/>
            <fo:table-column column-width="30mm"/>
            <fo:table-body>
              <fo:table-row>
                <fo:table-cell>
                  <fo:block xsl:use-attribute-sets="sidehead0">Table of contents</fo:block>
                </fo:table-cell>
                <fo:table-cell display-align="after">
                  <fo:block text-align="end" font-style="italic" font-size="10pt"
                      padding-bottom="4pt">Page</fo:block>
                </fo:table-cell>
              </fo:table-row>
            </fo:table-body>
          </fo:table>
        </fo:block>
        <fo:block start-indent="{$inner-type-limit}">
          <!-- Description section entries -->
          <xsl:if test="$has-description">
            <xsl:apply-templates select="$scope/content/description" mode="toc"/>
          </xsl:if>
          <!-- Procedure section entries -->
          <xsl:if test="$has-procedure">
            <xsl:apply-templates select="$scope/content/procedure" mode="toc"/>
          </xsl:if>
          <!-- Fault isolation entries -->
          <xsl:if test="$has-fault">
            <xsl:apply-templates select="$scope/content/faultIsolation" mode="toc"/>
          </xsl:if>
          <!-- Crew entries -->
          <xsl:if test="$has-crew">
            <xsl:apply-templates select="$scope/content/crew" mode="toc"/>
          </xsl:if>
          <!-- References entry -->
          <xsl:if test="$has-refs">
            <fo:block text-align-last="justify" space-before="2pt">
              <fo:basic-link internal-destination="references-section-{generate-id($scope)}" color="blue">
                <fo:inline>References</fo:inline>
              </fo:basic-link>
              <fo:leader leader-pattern="dots" leader-length.optimum="100%"/>
              <fo:page-number-citation ref-id="references-section-{generate-id($scope)}"/>
            </fo:block>
          </xsl:if>
        </fo:block>
      </fo:block>
    </xsl:if>
  </xsl:template>

  <!-- TOC entry for description -->
  <xsl:template match="description" mode="toc">
    <xsl:call-template name="toc-centerhead">
      <xsl:with-param name="title">Description</xsl:with-param>
    </xsl:call-template>
    <xsl:apply-templates select="levelledPara[title]" mode="toc"/>
  </xsl:template>

  <!-- TOC entry for procedure -->
  <xsl:template match="procedure" mode="toc">
    <xsl:apply-templates select="preliminaryRqmts|mainProcedure|closeRqmts|commonInfo" mode="toc"/>
  </xsl:template>

  <xsl:template match="preliminaryRqmts" mode="toc">
    <xsl:call-template name="toc-centerhead">
      <xsl:with-param name="title">Preliminary requirements</xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="mainProcedure" mode="toc">
    <xsl:call-template name="toc-centerhead">
      <xsl:with-param name="title">Procedure</xsl:with-param>
    </xsl:call-template>
    <xsl:apply-templates select="proceduralStep[title]" mode="toc"/>
  </xsl:template>

  <xsl:template match="closeRqmts" mode="toc">
    <xsl:call-template name="toc-centerhead">
      <xsl:with-param name="title">Requirements after job completion</xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="commonInfo" mode="toc">
    <xsl:call-template name="toc-centerhead">
      <xsl:with-param name="title">
        <xsl:choose>
          <xsl:when test="title">
            <xsl:value-of select="title"/>
          </xsl:when>
          <xsl:otherwise>Common information</xsl:otherwise>
        </xsl:choose>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!-- TOC entry for faultIsolation -->
  <xsl:template match="faultIsolation" mode="toc">
    <xsl:call-template name="toc-centerhead">
      <xsl:with-param name="title">Fault Isolation</xsl:with-param>
    </xsl:call-template>
    <xsl:apply-templates select="faultIsolationProcedure" mode="toc"/>
  </xsl:template>

  <xsl:template match="faultIsolationProcedure" mode="toc">
    <xsl:apply-templates select="isolationProcedure" mode="toc"/>
  </xsl:template>

  <xsl:template match="isolationProcedure" mode="toc">
    <xsl:apply-templates select="preliminaryRqmts|isolationMainProcedure|closeRqmts" mode="toc"/>
  </xsl:template>

  <xsl:template match="isolationMainProcedure" mode="toc">
    <xsl:call-template name="toc-centerhead">
      <xsl:with-param name="title">Fault Isolation Procedure</xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!-- TOC entry for crew -->
  <xsl:template match="crew" mode="toc">
    <xsl:call-template name="toc-centerhead">
      <xsl:with-param name="title">Crew/Operator Information</xsl:with-param>
    </xsl:call-template>
    <xsl:apply-templates select="crewDrill" mode="toc"/>
  </xsl:template>

  <xsl:template match="crewDrill" mode="toc">
    <xsl:call-template name="toc-centerhead">
      <xsl:with-param name="title">Crew Drill</xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!--
    TOC entry for levelled paragraphs and steps.

    Each level's NUMBER starts where its parent's TITLE starts, so "1.1" sits
    under the "B" of "BIT Built-In Test". A flat step per level — which is what
    this did — bears no relation to where the text above it actually begins, so
    the numbers and the titles march at different rates and nothing lines up
    with anything.

    Two measurements, and they have to agree:

      number-start  where this level's number sits: the column where its
                    parent's title began.
      number-w      the width of the number field, wide enough for "1.1.1.1"
                    without touching the title. The next level starts at
                    number-start + number-w, which is what makes the columns
                    chain.

    start-indent is measured from the REFERENCE AREA, not from the enclosing
    block, so these are absolute positions on the page. Written as an offset
    from the parent, every level would land somewhere else.
  -->
  <xsl:template match="levelledPara[title]|proceduralStep[title]" mode="toc">
    <xsl:variable name="level" select="count(ancestor::levelledPara|ancestor::proceduralStep) + 1"/>
    <!-- 8mm at level 1, widening by 2mm a level as the numbers grow. -->
    <xsl:variable name="number-w" select="6 + 2 * $level"/>
    <!--
      Where this level's NUMBER starts: the column where its parent's title
      began. 20mm at level 1, and thereafter 20 + the sum of every field above
      it — 20 + (n-1)² + 7(n-1).
    -->
    <xsl:variable name="number-start"
      select="20 + ($level - 1) * ($level - 1) + 7 * ($level - 1)"/>
    <!--
      A list-block, so the number occupies a field of KNOWN width and the title
      begins exactly at its end.

      A hanging indent with a space leader was measured and is not good enough:
      a leader pads by its own optimum length, not to a column, so the title
      landed 2mm short of where the next level's number would sit. Close enough
      to look deliberate and wrong enough to be visible down a page of entries.
      provisional-distance-between-starts IS the column, so the two agree by
      construction rather than by arithmetic that happens to come out.
    -->
    <fo:list-block space-before="2pt"
                   start-indent="{$number-start}mm"
                   provisional-distance-between-starts="{$number-w}mm"
                   provisional-label-separation="0mm">
      <fo:list-item>
        <fo:list-item-label end-indent="label-end()">
          <fo:block>
            <fo:basic-link internal-destination="{generate-id(.)}" color="blue">
              <xsl:apply-templates select="." mode="number"/>
            </fo:basic-link>
          </fo:block>
        </fo:list-item-label>
        <fo:list-item-body start-indent="body-start()">
          <fo:block text-align-last="justify">
            <fo:basic-link internal-destination="{generate-id(.)}" color="blue">
              <fo:inline><xsl:value-of select="title"/></fo:inline>
            </fo:basic-link>
            <fo:leader leader-pattern="dots" leader-length.optimum="100%"/>
            <fo:page-number-citation ref-id="{generate-id(.)}"/>
          </fo:block>
        </fo:list-item-body>
      </fo:list-item>
    </fo:list-block>
    <xsl:apply-templates select="levelledPara[title]|proceduralStep[title]" mode="toc"/>
  </xsl:template>

  <!-- Generic centerhead TOC entry template -->
  <xsl:template name="toc-centerhead">
    <xsl:param name="title"/>
    <fo:block text-align-last="justify" space-before="2pt">
      <fo:basic-link internal-destination="{generate-id(.)}" color="blue">
        <fo:inline>
          <xsl:value-of select="$title"/>
        </fo:inline>
      </fo:basic-link>
      <fo:leader leader-pattern="dots" leader-length.optimum="100%"/>
      <fo:page-number-citation ref-id="{generate-id(.)}"/>
    </fo:block>
  </xsl:template>

  <!-- Suppress text nodes in TOC mode -->
  <xsl:template match="text()" mode="toc"/>

  <!-- ==================================================================== -->
  <!--                    LIST OF TABLES (per DM)                           -->
  <!-- ==================================================================== -->
  <xsl:template name="list-of-tables">
    <xsl:param name="scope" select="ancestor-or-self::dmodule"/>
    <xsl:variable name="tables" select="$scope//table|$scope//reqCondGroup|$scope//reqSupportEquips|$scope//reqSupplies|$scope//reqSpares"/>
    <xsl:variable name="has-refs" select="$scope/content/refs"/>
    <xsl:if test="$tables or $has-refs">
      <fo:block font-family="{$font-stack}" id="lot-{generate-id($scope)}" space-after="16pt">
        <fo:block xsl:use-attribute-sets="sidehead0">List of tables</fo:block>
        <fo:block start-indent="{$inner-type-limit}" space-before="6pt">
          <!-- References table entry (always Table 1 in S1000D) -->
          <xsl:if test="$has-refs and not(contains($document.format, 'JSS'))">
            <fo:block text-align-last="justify" space-before="2pt">
              <fo:basic-link internal-destination="references-section-{generate-id($scope)}" color="blue">
                <fo:inline>
                  <xsl:text>1&#xA0;&#xA0;&#xA0;&#xA0;</xsl:text>
                  <xsl:text>References</xsl:text>
                </fo:inline>
              </fo:basic-link>
              <fo:leader leader-pattern="dots" leader-length.optimum="100%"/>
              <fo:page-number-citation ref-id="references-section-{generate-id($scope)}"/>
            </fo:block>
          </xsl:if>
          <!-- Other tables -->
          <xsl:apply-templates select="$tables" mode="lot"/>
        </fo:block>
      </fo:block>
    </xsl:if>
  </xsl:template>

  <xsl:template match="table|reqCondGroup|reqSupportEquips|reqSupplies|reqSpares" mode="lot">
    <!-- Generate the target ID, matching the actual table/element ID -->
    <xsl:variable name="target-id">
      <xsl:choose>
        <xsl:when test="@id">
          <xsl:call-template name="generate-link-id">
            <xsl:with-param name="localId" select="@id"/>
          </xsl:call-template>
        </xsl:when>
        <xsl:when test="self::table">
          <!-- tables.xsl uses 'table-auto-' prefix for tables without @id -->
          <xsl:text>table-auto-</xsl:text>
          <xsl:value-of select="generate-id()"/>
        </xsl:when>
        <xsl:otherwise>
          <!-- requirements tables use plain generate-id() -->
          <xsl:value-of select="generate-id()"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <fo:block text-align-last="justify" space-before="2pt">
      <fo:basic-link color="blue" internal-destination="{$target-id}">
        <fo:inline>
          <!-- Add "Table" label only for JSS format -->
          <xsl:if test="contains($document.format, 'JSS')">
            <xsl:text>Table </xsl:text>
          </xsl:if>
          <xsl:apply-templates select="." mode="number"/>
          <xsl:text>&#xA0;&#xA0;&#xA0;&#xA0;</xsl:text>
          <xsl:choose>
            <xsl:when test="self::table">
              <xsl:value-of select="title"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:apply-templates select="." mode="title"/>
            </xsl:otherwise>
          </xsl:choose>
        </fo:inline>
      </fo:basic-link>
      <fo:leader leader-pattern="dots" leader-length.optimum="100%"/>
      <fo:page-number-citation ref-id="{$target-id}"/>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    LIST OF FIGURES (per DM)                          -->
  <!-- ==================================================================== -->
  <xsl:template name="list-of-figures">
    <xsl:param name="scope" select="ancestor-or-self::dmodule"/>
    <xsl:variable name="figures" select="$scope//figure"/>
    <xsl:if test="$figures">
      <fo:block font-family="{$font-stack}" id="lof-{generate-id($scope)}" space-after="16pt">
        <fo:block xsl:use-attribute-sets="sidehead0">List of figures</fo:block>
        <fo:block start-indent="{$inner-type-limit}" space-before="6pt">
          <xsl:apply-templates select="$figures" mode="lof"/>
        </fo:block>
      </fo:block>
    </xsl:if>
  </xsl:template>

  <xsl:template match="figure" mode="lof">
    <fo:block text-align-last="justify" space-before="2pt">
      <fo:basic-link color="blue">
        <xsl:attribute name="internal-destination">
          <!-- Must match figures.xsl exactly, so a repeated figure's entry
               points at that copy and not at the first one. -->
          <xsl:call-template name="unique-id"/>
        </xsl:attribute>
        <fo:inline>
          <!-- Add "Figure" label only for JSS format -->
          <xsl:if test="contains($document.format, 'JSS')">
            <xsl:text>Figure </xsl:text>
          </xsl:if>
          <xsl:apply-templates select="." mode="number"/>
          <xsl:text>&#xA0;&#xA0;&#xA0;&#xA0;</xsl:text>
          <xsl:apply-templates select="." mode="title"/>
        </fo:inline>
      </fo:basic-link>
      <fo:leader leader-pattern="dots" leader-length.optimum="100%"/>
      <fo:page-number-citation>
        <xsl:attribute name="ref-id">
          <!-- Must match figures.xsl exactly, so a repeated figure's entry
               points at that copy and not at the first one. -->
          <xsl:call-template name="unique-id"/>
        </xsl:attribute>
      </fo:page-number-citation>
    </fo:block>
  </xsl:template>

</xsl:stylesheet>